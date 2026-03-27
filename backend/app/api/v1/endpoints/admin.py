import logging
from uuid import UUID

from celery import Celery
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.database import get_db
from app.schemas.admin import (
    DashboardStats,
    PriceAnomaly,
    RecentProduct,
    ScraperOverview,
    SpiderStatus,
    StoreHealth,
    TaskResult,
    TriggerResponse,
)
from app.services.admin_service import (
    get_dashboard_stats,
    get_match_stats,
    get_pending_matches,
    get_price_anomalies,
    get_recent_products,
    get_store_health,
    review_match,
)

logger = logging.getLogger(__name__)
router = APIRouter()

settings = get_settings()

CELERY_BROKER = settings.REDIS_URL
celery_app = Celery("qiymetleri_scraper", broker=CELERY_BROKER, backend=CELERY_BROKER)

SPIDER_META = {
    "kontakt_home": {"display_name": "Kontakt Home", "schedule": "Hər 2 saatda"},
    "baku_electronics": {"display_name": "Baku Electronics", "schedule": "Hər 4 saatda"},
    "irshad_electronics": {"display_name": "Irshad Electronics", "schedule": "Hər 4 saatda"},
    "ispace": {"display_name": "iSpace", "schedule": "Hər 4 saatda"},
}


@router.get("/dashboard", response_model=DashboardStats)
async def dashboard(db: AsyncSession = Depends(get_db)):
    return await get_dashboard_stats(db)


@router.get("/scraper/status", response_model=ScraperOverview)
async def scraper_status():
    """Get current Celery worker and task status."""
    inspector = celery_app.control.inspect()

    try:
        active = inspector.active() or {}
        scheduled = inspector.scheduled() or {}
    except Exception:
        logger.warning("Cannot connect to Celery workers")
        active = {}
        scheduled = {}

    worker_online = len(active) > 0
    active_tasks_count = sum(len(tasks) for tasks in active.values())
    scheduled_count = sum(len(tasks) for tasks in scheduled.values())

    active_spiders = set()
    for tasks in active.values():
        for task in tasks:
            args = task.get("args", [])
            if args:
                active_spiders.add(args[0] if isinstance(args, list) else args)

    spiders = []
    for spider_name, meta in SPIDER_META.items():
        last = _get_last_task_result(spider_name)
        spiders.append(SpiderStatus(
            name=spider_name,
            display_name=meta["display_name"],
            last_run=last.get("completed_at") if last else None,
            last_status=last.get("status") if last else None,
            last_item_count=last.get("item_count") if last else None,
            last_duration=last.get("duration") if last else None,
            schedule=meta["schedule"],
            is_running=spider_name in active_spiders,
        ))

    return ScraperOverview(
        spiders=spiders,
        worker_online=worker_online,
        active_tasks=active_tasks_count,
        scheduled_tasks=scheduled_count,
    )


@router.post("/scraper/trigger/{spider_name}", response_model=TriggerResponse)
async def trigger_spider(spider_name: str):
    """Manually trigger a spider crawl."""
    if spider_name not in SPIDER_META:
        raise HTTPException(status_code=404, detail=f"Unknown spider: {spider_name}")

    try:
        result = celery_app.send_task("tasks.crawl_spider", args=[spider_name])
        return TriggerResponse(
            task_id=result.id,
            spider=spider_name,
            status="queued",
            message=f"{SPIDER_META[spider_name]['display_name']} spider triggered",
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Cannot reach Celery worker: {e}")


@router.get("/scraper/history", response_model=list[TaskResult])
async def scraper_history(limit: int = Query(default=20, ge=1, le=100)):
    """Get recent scraper task results from Redis backend."""
    results = []

    try:
        import redis as sync_redis
        r = sync_redis.from_url(CELERY_BROKER, decode_responses=True)
        keys = []
        for key in r.scan_iter(match="celery-task-meta-*", count=200):
            keys.append(key)
        keys = keys[:200]

        import json
        for key in keys:
            raw = r.get(key)
            if not raw:
                continue
            try:
                data = json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                continue

            task_result = data.get("result", {})
            if not isinstance(task_result, dict):
                task_result = {}

            spider = task_result.get("spider", "unknown")
            if spider == "unknown":
                args = data.get("args", [])
                if args and isinstance(args, list):
                    spider = args[0]

            task_id = key.replace("celery-task-meta-", "")
            status = data.get("status", "UNKNOWN")
            date_done = data.get("date_done")

            results.append(TaskResult(
                task_id=task_id,
                spider=spider,
                status=status,
                started_at=None,
                completed_at=date_done,
                item_count=task_result.get("items"),
                duration=task_result.get("elapsed_seconds"),
                error=str(data.get("result")) if status == "FAILURE" else None,
            ))
    except Exception as e:
        logger.warning("Cannot read task history from Redis: %s", e)

    results.sort(key=lambda x: x.completed_at or "", reverse=True)
    return results[:limit]


@router.get("/stores", response_model=list[StoreHealth])
async def stores(db: AsyncSession = Depends(get_db)):
    return await get_store_health(db)


@router.get("/anomalies", response_model=list[PriceAnomaly])
async def anomalies(
    threshold: float = Query(default=30.0, ge=5.0, le=100.0),
    hours: int = Query(default=24, ge=1, le=168),
    db: AsyncSession = Depends(get_db),
):
    return await get_price_anomalies(db, threshold_pct=threshold, hours=hours)


@router.get("/scraper/health")
async def scraper_health(db: AsyncSession = Depends(get_db)):
    """Get scraper health summary from DB-stored run history."""
    from sqlalchemy import text as sa_text

    result = await db.execute(sa_text("""
        SELECT DISTINCT ON (spider) spider, status, items_scraped, errors,
               duration_seconds, started_at, finished_at
        FROM scraper_runs
        ORDER BY spider, started_at DESC
    """))
    rows = result.fetchall()

    # Recent failure rate per spider (last 24h)
    failure_result = await db.execute(sa_text("""
        SELECT spider,
               COUNT(*) as total_runs,
               COUNT(*) FILTER (WHERE status = 'failed') as failed_runs
        FROM scraper_runs
        WHERE started_at > NOW() - INTERVAL '24 hours'
        GROUP BY spider
    """))
    failure_rates = {r.spider: {"total": r.total_runs, "failed": r.failed_runs}
                     for r in failure_result.fetchall()}

    spiders = []
    for row in rows:
        rates = failure_rates.get(row.spider, {"total": 0, "failed": 0})
        fail_pct = (rates["failed"] / rates["total"] * 100) if rates["total"] > 0 else 0
        spiders.append({
            "spider": row.spider,
            "last_status": row.status,
            "last_items": row.items_scraped,
            "last_errors": row.errors,
            "last_duration_s": row.duration_seconds,
            "last_run": row.finished_at.isoformat() if row.finished_at else None,
            "runs_24h": rates["total"],
            "failures_24h": rates["failed"],
            "failure_rate_pct": round(fail_pct, 1),
            "healthy": fail_pct < 30,
        })

    return {"spiders": spiders}


@router.get("/products/recent", response_model=list[RecentProduct])
async def recent_products(
    minutes: int = Query(default=60, ge=1, le=1440),
    store_id: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Get products added or updated recently."""
    return await get_recent_products(db, minutes=minutes, store_id=store_id)


@router.get("/matches/stats")
async def match_statistics(db: AsyncSession = Depends(get_db)):
    """Get product match statistics."""
    return await get_match_stats(db)


@router.get("/matches/pending")
async def pending_matches(
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Get product matches pending manual review."""
    return await get_pending_matches(db, limit=limit)


@router.post("/matches/{match_id}/{action}")
async def review_product_match(
    match_id: int,
    action: str,
    db: AsyncSession = Depends(get_db),
):
    """Accept or reject a product match."""
    if action not in ("accept", "reject"):
        raise HTTPException(status_code=400, detail="Action must be 'accept' or 'reject'")
    result = await review_match(db, match_id, action)
    if result is None:
        raise HTTPException(status_code=404, detail="Match not found")
    return result


def _get_last_task_result(spider_name: str) -> dict | None:
    """Get the most recent completed task result for a spider from Redis."""
    try:
        import json
        import redis as sync_redis
        r = sync_redis.from_url(CELERY_BROKER, decode_responses=True)

        best = None
        for key in r.scan_iter(match="celery-task-meta-*", count=200):
            raw = r.get(key)
            if not raw:
                continue
            try:
                data = json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                continue

            result = data.get("result", {})
            if isinstance(result, dict) and result.get("spider") == spider_name:
                date_done = data.get("date_done", "")
                if best is None or date_done > best.get("_date", ""):
                    best = {
                        "status": result.get("status", data.get("status")),
                        "item_count": result.get("items"),
                        "duration": result.get("elapsed_seconds"),
                        "completed_at": date_done,
                        "_date": date_done,
                    }
        if best:
            best.pop("_date", None)
        return best
    except Exception:
        return None


# ── Product Management ──────────────────────────────────────────────


class ProductUpdate(BaseModel):
    name: str | None = None
    brand: str | None = None
    category: str | None = None
    model_family: str | None = None
    image_url: str | None = None


class AdminProduct(BaseModel):
    id: str
    canonical_id: str | None
    name: str
    brand: str | None
    category: str | None
    model_family: str | None
    image_url: str | None
    created_at: str | None
    updated_at: str | None
    prices: list[dict]


@router.get("/products", response_model=dict)
async def list_admin_products(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=25, ge=1, le=100),
    category: str | None = Query(default=None),
    brand: str | None = Query(default=None),
    store_id: str | None = Query(default=None),
    q: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """List products for admin management (not grouped by family)."""
    from sqlalchemy import select, func as sa_func
    from app.models.product import Product, CurrentPrice

    query = select(Product).options(
        selectinload(Product.current_prices)
    )

    if q and len(q) >= 2:
        query = query.where(Product.name.ilike(f"%{q}%"))
    if category:
        query = query.where(Product.category == category)
    if brand:
        query = query.where(Product.brand == brand)
    if store_id:
        query = query.join(CurrentPrice).where(CurrentPrice.store_id == store_id)

    # Count
    count_q = select(sa_func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Paginate
    query = query.order_by(Product.updated_at.desc()).offset(
        (page - 1) * per_page
    ).limit(per_page)

    result = await db.execute(query)
    products = result.scalars().unique().all()

    items = []
    for p in products:
        items.append({
            "id": str(p.id),
            "canonical_id": p.canonical_id,
            "name": p.name,
            "brand": p.brand,
            "category": p.category,
            "model_family": p.model_family,
            "image_url": p.image_url,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "updated_at": p.updated_at.isoformat() if p.updated_at else None,
            "prices": [
                {
                    "store_id": cp.store_id,
                    "price_azn": float(cp.price_azn),
                    "in_stock": cp.in_stock,
                    "url": cp.url,
                }
                for cp in p.current_prices
            ],
        })

    return {"items": items, "total": total, "page": page, "per_page": per_page}


@router.patch("/products/{product_id}")
async def update_product(
    product_id: str,
    updates: ProductUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update product fields (name, brand, category, model_family, image_url)."""
    from sqlalchemy import select
    from app.models.product import Product

    pid = UUID(product_id)
    result = await db.execute(select(Product).where(Product.id == pid))
    product = result.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    update_data = updates.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    for field, value in update_data.items():
        setattr(product, field, value)

    await db.commit()
    await db.refresh(product)

    # Invalidate cache
    _invalidate_product_cache(product.canonical_id)

    return {
        "id": str(product.id),
        "name": product.name,
        "brand": product.brand,
        "category": product.category,
        "model_family": product.model_family,
        "updated": True,
    }


@router.delete("/products/batch/delete")
async def batch_delete_products(
    product_ids: list[str] = Body(...),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple products at once."""
    from sqlalchemy import select, delete as sa_delete
    from app.models.product import Product, CurrentPrice

    uuids = [UUID(pid) for pid in product_ids]

    # Get canonical_ids for cache invalidation
    result = await db.execute(
        select(Product.canonical_id).where(Product.id.in_(uuids))
    )
    canonical_ids = [r[0] for r in result.all()]

    await db.execute(
        sa_delete(CurrentPrice).where(CurrentPrice.product_id.in_(uuids))
    )
    del_result = await db.execute(
        sa_delete(Product).where(Product.id.in_(uuids))
    )
    await db.commit()

    for cid in canonical_ids:
        _invalidate_product_cache(cid)

    return {"deleted": del_result.rowcount}


@router.delete("/products/{product_id}")
async def delete_product(
    product_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a product and its current prices."""
    from sqlalchemy import select, delete as sa_delete
    from app.models.product import Product, CurrentPrice

    pid = UUID(product_id)
    result = await db.execute(select(Product).where(Product.id == pid))
    product = result.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    canonical_id = product.canonical_id

    # Delete current_prices first (may not cascade depending on DB setup)
    await db.execute(
        sa_delete(CurrentPrice).where(CurrentPrice.product_id == pid)
    )
    await db.delete(product)
    await db.commit()

    _invalidate_product_cache(canonical_id)

    return {"id": product_id, "deleted": True}


def _invalidate_product_cache(canonical_id: str | None):
    """Invalidate Redis cache for a product."""
    try:
        import redis as sync_redis
        r = sync_redis.from_url(settings.REDIS_URL, decode_responses=True)
        if canonical_id:
            r.delete(f"product:{canonical_id}")
        # Also clear list and filter caches
        for pattern in ("products:list:*", "filters:*"):
            for key in r.scan_iter(match=pattern, count=100):
                r.delete(key)
    except Exception:
        logger.debug("Could not invalidate Redis cache")

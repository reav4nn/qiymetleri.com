import logging

from celery import Celery
from celery.result import AsyncResult
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.schemas.admin import (
    DashboardStats,
    PriceAnomaly,
    ScraperOverview,
    SpiderStatus,
    StoreHealth,
    TaskResult,
    TriggerResponse,
)
from app.services.admin_service import (
    get_dashboard_stats,
    get_price_anomalies,
    get_store_health,
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
                children = data.get("children", [])
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

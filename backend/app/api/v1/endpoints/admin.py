import logging
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from uuid import uuid4
from uuid import UUID

from croniter import croniter
from celery import Celery
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel, AnyHttpUrl, Field, model_validator
from sqlalchemy import text as sa_text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.database import get_db
from app.api.dependencies import require_admin
from app.schemas.admin import (
    DashboardStats,
    PriceAnomaly,
    RecentProduct,
    ScraperOverview,
    SpiderStatus,
    StoreHealth,
    TaskResult,
    TriggerResponse,
    ModelMappingResolution,
    ProductModelCreate,
    ProductModelMerge,
    SpecCaseResolution,
    SpecImportCommit,
    SpecImportPayload,
    OfficialSpecIngest,
)
from app.services.admin_service import (
    get_dashboard_stats,
    get_match_stats,
    get_pending_matches,
    get_price_anomalies,
    get_recent_products,
    get_store_health,
)
from app.services.model_mapping_service import (
    create_product_model,
    list_mapping_reviews,
    list_product_models,
    merge_product_models,
    resolve_mapping_review,
)
from app.services.spec_ingestion_service import (
    SpecValueError,
    calculate_model_readiness,
    commit_import_rows,
    make_import_token,
    resolve_case,
    validate_import_rows,
    verify_import_token,
    ingest_document,
    ObservationInput,
)
from shared.spec_ingestion import (
    OFFICIAL_ADAPTERS,
    SpecValueError as SharedSpecValueError,
)

logger = logging.getLogger(__name__)
router = APIRouter()

settings = get_settings()

CELERY_BROKER = settings.CELERY_BROKER_URL
CELERY_RESULTS = settings.CELERY_RESULT_BACKEND
celery_app = Celery("qiymetleri_scraper", broker=CELERY_BROKER, backend=CELERY_RESULTS)

SPIDER_META = {
    "kontakt_home": {"display_name": "Kontakt Home", "schedule": "Hər 2 saatda"},
    "baku_electronics": {
        "display_name": "Baku Electronics",
        "schedule": "Hər 4 saatda",
    },
    "irshad_electronics": {
        "display_name": "Irshad Electronics",
        "schedule": "Hər 4 saatda",
    },
    "ispace": {"display_name": "iSpace", "schedule": "Hər 4 saatda"},
}


class ScheduleUpdate(BaseModel):
    is_enabled: bool
    schedule_type: str = Field(pattern="^(interval|cron)$")
    interval_minutes: int | None = Field(default=None, ge=30, le=10080)
    cron_expression: str | None = None

    @model_validator(mode="after")
    def validate_schedule(self):
        if self.schedule_type == "interval" and self.interval_minutes is None:
            raise ValueError("Interval dəqiqələri tələb olunur")
        if self.schedule_type == "cron":
            if (
                not self.cron_expression
                or len(self.cron_expression.split()) != 5
                or not croniter.is_valid(self.cron_expression)
            ):
                raise ValueError("Etibarlı 5 hissəli cron ifadəsi tələb olunur")
        return self


class StoreUpdate(BaseModel):
    is_active: bool


@router.get("/specs/cases")
async def list_spec_cases(
    status: str = Query("open", pattern="^(open|assigned|resolved|dismissed|all)$"),
    case_type: str | None = Query(
        None, pattern="^(mapping|conflict|incomplete|stale)$"
    ),
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    clauses = ["1=1"]
    params: dict = {"limit": per_page, "offset": (page - 1) * per_page}
    if status != "all":
        clauses.append("c.status=:status")
        params["status"] = status
    if case_type:
        clauses.append("c.case_type=:case_type")
        params["case_type"] = case_type
    where = " AND ".join(clauses)
    total = int(
        await db.scalar(
            sa_text(f"SELECT COUNT(*) FROM spec_moderation_cases c WHERE {where}"),
            params,
        )
        or 0
    )
    rows = (
        await db.execute(
            sa_text(f"""
                SELECT c.*, d.key AS definition_key, d.labels AS definition_labels,
                       pm.brand AS model_brand, pm.name AS model_name,
                       cv.selected_observation_id,
                       COALESCE((
                           SELECT jsonb_agg(jsonb_build_object(
                               'id', o.id, 'status', o.status,
                               'original_value', o.original_value,
                               'original_unit', o.original_unit,
                               'source_type', sd.source_type,
                               'source_url', sd.source_url,
                               'observed_at', o.observed_at,
                               'confidence', o.confidence
                           ) ORDER BY o.observed_at DESC)
                           FROM spec_observations o
                           JOIN source_documents sd ON sd.id=o.source_document_id
                           WHERE o.definition_id=c.definition_id
                             AND ((c.entity_type='model' AND o.model_id::text=c.entity_id)
                               OR (c.entity_type='product' AND o.product_id::text=c.entity_id))
                       ), '[]'::jsonb) AS observations
                FROM spec_moderation_cases c
                LEFT JOIN spec_definitions d ON d.id=c.definition_id
                LEFT JOIN product_models pm
                    ON c.entity_type='model' AND pm.id::text=c.entity_id
                LEFT JOIN canonical_spec_values cv
                    ON cv.definition_id=c.definition_id
                   AND ((c.entity_type='model' AND cv.model_id::text=c.entity_id)
                     OR (c.entity_type='product' AND cv.product_id::text=c.entity_id))
                WHERE {where}
                ORDER BY (c.due_at < NOW()) DESC, c.created_at
                LIMIT :limit OFFSET :offset
            """),
            params,
        )
    ).all()
    return {
        "items": [dict(row._mapping) for row in rows],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.post("/specs/ingest-official")
async def ingest_official_specs(
    payload: OfficialSpecIngest,
    db: AsyncSession = Depends(get_db),
    actor: str = Depends(require_admin),
):
    adapter = OFFICIAL_ADAPTERS.get(payload.adapter)
    if not adapter:
        raise HTTPException(status_code=422, detail="Official adapter tanınmır")
    try:
        manufacturer_domain = adapter.validate_url(payload.source_url)
        parsed = adapter.parse(payload.payload)
        observations = [
            ObservationInput(
                definition_key=item.key,
                value=item.value,
                unit=item.unit,
                confidence=item.confidence,
                model_id=payload.model_id,
            )
            for item in parsed
        ]
        result = await ingest_document(
            db,
            source_type="official",
            source_url=payload.source_url,
            parser_name=adapter.name,
            parser_version=adapter.version,
            raw_payload=payload.payload,
            observations=observations,
            actor=actor,
            reason=f"Official manufacturer ingestion via {adapter.name}",
            manufacturer_domain=manufacturer_domain,
        )
        await db.commit()
        return {
            "document_id": result.document_id,
            "idempotent": result.idempotent,
            "accepted": result.accepted,
            "rejected": result.rejected,
            "conflicts": result.conflicts,
        }
    except (SpecValueError, SharedSpecValueError) as exc:
        await db.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/specs/cases/{case_id}/resolve")
async def resolve_spec_case(
    case_id: UUID,
    payload: SpecCaseResolution,
    db: AsyncSession = Depends(get_db),
    actor: str = Depends(require_admin),
):
    try:
        result = await resolve_case(
            db,
            case_id=case_id,
            action=payload.action,
            observation_id=payload.observation_id,
            reason=payload.reason,
            actor=actor,
        )
        await db.commit()
        return result
    except SpecValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/specs/imports/validate")
async def validate_spec_import(
    payload: SpecImportPayload,
    db: AsyncSession = Depends(get_db),
):
    raw_size = len(payload.model_dump_json().encode())
    if raw_size > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Import 10 MB limitini keçir")
    try:
        diff = await validate_import_rows(db, payload.rows)
    except SpecValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    token = make_import_token(
        payload.rows, settings.SPEC_IMPORT_SIGNING_KEY, datetime.now(timezone.utc)
    )
    return {"token": token, "expires_in_seconds": 1800, "diff": diff}


@router.post("/specs/imports/{token}/commit")
async def commit_spec_import(
    token: str,
    payload: SpecImportCommit,
    db: AsyncSession = Depends(get_db),
    actor: str = Depends(require_admin),
):
    try:
        verify_import_token(
            token,
            payload.rows,
            settings.SPEC_IMPORT_SIGNING_KEY,
            datetime.now(timezone.utc),
        )
        await validate_import_rows(db, payload.rows)
        result = await commit_import_rows(
            db, payload.rows, actor=actor, reason=payload.reason
        )
        await db.commit()
        return result
    except SpecValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/specs/models/{model_id}/completeness")
async def model_spec_completeness(
    model_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    try:
        return await calculate_model_readiness(db, model_id, persist=False)
    except SpecValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/specs/readiness/scan")
async def scan_spec_readiness(
    limit: int = Query(500, ge=1, le=5000),
    db: AsyncSession = Depends(get_db),
    actor: str = Depends(require_admin),
):
    queued = (
        (
            await db.execute(
                sa_text("""
                SELECT model_id FROM spec_readiness_queue
                ORDER BY requested_at LIMIT :limit FOR UPDATE SKIP LOCKED
            """),
                {"limit": limit},
            )
        )
        .scalars()
        .all()
    )
    if not queued:
        queued = (
            (
                await db.execute(
                    sa_text("""
                    SELECT id FROM product_models
                    WHERE category_id='smartphones' AND status<>'archived'
                    ORDER BY updated_at LIMIT :limit
                """),
                    {"limit": limit},
                )
            )
            .scalars()
            .all()
        )
    ready = 0
    for model_id in queued:
        result = await calculate_model_readiness(db, model_id, persist=True)
        ready += int(result["is_comparison_ready"])
    await db.commit()
    return {"processed": len(queued), "ready": ready, "actor": actor}


@router.get("/specs/runs")
async def list_spec_runs(
    status: str | None = Query(None, pattern="^(queued|running|success|failed)$"),
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    where = "WHERE status=:status" if status else ""
    params = {
        "status": status,
        "limit": per_page,
        "offset": (page - 1) * per_page,
    }
    rows = (
        await db.execute(
            sa_text(f"""
                SELECT * FROM spec_ingestion_runs {where}
                ORDER BY id DESC LIMIT :limit OFFSET :offset
            """),
            params,
        )
    ).all()
    total = int(
        await db.scalar(
            sa_text(f"SELECT COUNT(*) FROM spec_ingestion_runs {where}"), params
        )
        or 0
    )
    return {"items": [dict(row._mapping) for row in rows], "total": total}


@router.post("/specs/runs/{run_id}/retry")
async def retry_spec_run(
    run_id: int,
    reason: str = Body(embed=True, min_length=3, max_length=2000),
    db: AsyncSession = Depends(get_db),
    actor: str = Depends(require_admin),
):
    row = (
        await db.execute(
            sa_text("""
                SELECT * FROM spec_ingestion_runs
                WHERE id=:id AND status='failed' FOR UPDATE
            """),
            {"id": run_id},
        )
    ).first()
    if not row:
        raise HTTPException(status_code=409, detail="Retry üçün failed run tapılmadı")
    task_id = str(uuid4())
    await db.execute(
        sa_text("""
            UPDATE spec_ingestion_runs SET task_id=:task_id, status='queued',
                attempt=1, error=NULL, started_at=NULL, finished_at=NULL
            WHERE id=:id
        """),
        {"task_id": task_id, "id": run_id},
    )
    await db.execute(
        sa_text("""
            INSERT INTO spec_audit_events
                (actor, action, entity_type, entity_id, reason, before, after)
            VALUES
                (:actor, 'ingestion.retry', 'spec_ingestion_run', :entity_id,
                 :reason, jsonb_build_object('status','failed'),
                 jsonb_build_object('status','queued','task_id',:task_id))
        """),
        {
            "actor": actor,
            "entity_id": str(run_id),
            "reason": reason,
            "task_id": task_id,
        },
    )
    await db.commit()
    celery_app.send_task(
        "tasks.run_official_adapter",
        args=[row.source_adapter, run_id],
        task_id=task_id,
        queue="specs",
    )
    return {"run_id": run_id, "task_id": task_id, "status": "queued"}


@router.get("/scrapers")
async def list_scrapers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(sa_text("""
        SELECT c.spider, c.store_id, c.display_name, c.is_enabled, c.schedule_type,
               c.interval_minutes, c.cron_expression, c.timezone, c.next_run_at,
               r.id, r.status, r.items_saved, r.finished_at, r.duration_seconds
        FROM scraper_configs c LEFT JOIN LATERAL (
            SELECT * FROM scraper_runs WHERE spider=c.spider ORDER BY started_at DESC LIMIT 1
        ) r ON TRUE ORDER BY c.display_name
    """))
    try:
        from app.core.cache import redis_client

        queue_count = int(await redis_client.llen("scraping"))
        beat_online = bool(await redis_client.get("scraper:beat:heartbeat"))
    except Exception:
        queue_count, beat_online = 0, False
    try:
        worker_online = bool(celery_app.control.inspect(timeout=1).ping())
    except Exception:
        worker_online = False
    return {
        "worker_online": worker_online,
        "beat_online": beat_online,
        "queue_count": queue_count,
        "scrapers": [dict(row._mapping) for row in result.all()],
    }


@router.patch("/scrapers/{name}/schedule")
async def update_schedule(
    name: str, payload: ScheduleUpdate, db: AsyncSession = Depends(get_db)
):
    if name not in SPIDER_META:
        raise HTTPException(status_code=404, detail="Scraper tapılmadı")
    now = datetime.now(timezone.utc)
    local_now = now.astimezone(ZoneInfo("Asia/Baku"))
    next_run = (
        now + timedelta(minutes=payload.interval_minutes or 60)
        if payload.schedule_type == "interval"
        else croniter(payload.cron_expression, local_now)
        .get_next(datetime)
        .astimezone(timezone.utc)
    )
    result = await db.execute(
        sa_text("""
        UPDATE scraper_configs SET is_enabled=:enabled, schedule_type=:kind,
            interval_minutes=:minutes, cron_expression=:cron, next_run_at=:next,
            updated_at=NOW() WHERE spider=:spider RETURNING spider
    """),
        {
            "enabled": payload.is_enabled,
            "kind": payload.schedule_type,
            "minutes": (
                payload.interval_minutes
                if payload.schedule_type == "interval"
                else None
            ),
            "cron": (
                payload.cron_expression if payload.schedule_type == "cron" else None
            ),
            "next": next_run,
            "spider": name,
        },
    )
    if not result.first():
        raise HTTPException(status_code=404, detail="Scraper konfiqurasiyası tapılmadı")
    return {"spider": name, "updated": True, "next_run_at": next_run}


async def _queue_run(name: str, trigger: str, db: AsyncSession) -> dict:
    running = await db.scalar(
        sa_text("""
        SELECT EXISTS(SELECT 1 FROM scraper_runs WHERE spider=:spider AND status IN ('queued','running'))
    """),
        {"spider": name},
    )
    if running:
        raise HTTPException(
            status_code=409, detail="Bu scraper artıq növbədədir və ya işləyir"
        )
    task_id = str(uuid4())
    run_id = (
        await db.execute(
            sa_text("""
        INSERT INTO scraper_runs (task_id, spider, trigger, status, started_at)
        VALUES (:task, :spider, :trigger, 'queued', NOW()) RETURNING id
    """),
            {"task": task_id, "spider": name, "trigger": trigger},
        )
    ).scalar_one()
    await db.commit()
    celery_app.send_task(
        "tasks.crawl_spider",
        args=[name, run_id, trigger],
        task_id=task_id,
        queue="scraping",
    )
    return {"task_id": task_id, "run_id": run_id, "spider": name, "status": "queued"}


@router.post("/scrapers/{name}/runs")
async def run_scraper(name: str, db: AsyncSession = Depends(get_db)):
    if name not in SPIDER_META:
        raise HTTPException(status_code=404, detail="Scraper tapılmadı")
    return await _queue_run(name, "manual", db)


@router.post("/scrapers/run-all")
async def run_all(db: AsyncSession = Depends(get_db)):
    runs = []
    for name in SPIDER_META:
        try:
            runs.append(await _queue_run(name, "manual", db))
        except HTTPException as exc:
            if exc.status_code != 409:
                raise
    return {"runs": runs}


@router.get("/scraper-runs")
async def list_runs(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    status: str | None = None,
    spider: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    where = ["1=1"]
    params: dict = {"limit": per_page, "offset": (page - 1) * per_page}
    if status:
        where.append("status=:status")
        params["status"] = status
    if spider:
        where.append("spider=:spider")
        params["spider"] = spider
    clause = " AND ".join(where)
    total = await db.scalar(
        sa_text(f"SELECT COUNT(*) FROM scraper_runs WHERE {clause}"), params
    )
    rows = (
        await db.execute(
            sa_text(f"""
        SELECT id, task_id, spider, trigger, status, attempt, items_seen, items_saved,
               items_dropped, errors, duration_seconds, started_at, finished_at, error_message
        FROM scraper_runs WHERE {clause} ORDER BY started_at DESC LIMIT :limit OFFSET :offset
    """),
            params,
        )
    ).all()
    return {
        "items": [dict(row._mapping) for row in rows],
        "total": total or 0,
        "page": page,
        "per_page": per_page,
    }


@router.get("/scraper-runs/{run_id}")
async def run_detail(run_id: int, db: AsyncSession = Depends(get_db)):
    run = (
        await db.execute(
            sa_text("SELECT * FROM scraper_runs WHERE id=:id"), {"id": run_id}
        )
    ).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run tapılmadı")
    categories = (
        await db.execute(
            sa_text(
                "SELECT * FROM scraper_run_categories WHERE run_id=:id ORDER BY category"
            ),
            {"id": run_id},
        )
    ).all()
    return {
        "run": dict(run._mapping),
        "categories": [dict(row._mapping) for row in categories],
    }


@router.patch("/stores/{store_id}")
async def update_store(
    store_id: str, payload: StoreUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        sa_text("UPDATE stores SET is_active=:active WHERE id=:id RETURNING id"),
        {"active": payload.is_active, "id": store_id},
    )
    if not result.first():
        raise HTTPException(status_code=404, detail="Mağaza tapılmadı")
    return {"id": store_id, "is_active": payload.is_active}


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
        spiders.append(
            SpiderStatus(
                name=spider_name,
                display_name=meta["display_name"],
                last_run=last.get("completed_at") if last else None,
                last_status=last.get("status") if last else None,
                last_item_count=last.get("item_count") if last else None,
                last_duration=last.get("duration") if last else None,
                schedule=meta["schedule"],
                is_running=spider_name in active_spiders,
            )
        )

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

        r = sync_redis.from_url(CELERY_RESULTS, decode_responses=True)
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

            results.append(
                TaskResult(
                    task_id=task_id,
                    spider=spider,
                    status=status,
                    started_at=None,
                    completed_at=date_done,
                    item_count=task_result.get("items"),
                    duration=task_result.get("elapsed_seconds"),
                    error=str(data.get("result")) if status == "FAILURE" else None,
                )
            )
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
    failure_rates = {
        r.spider: {"total": r.total_runs, "failed": r.failed_runs}
        for r in failure_result.fetchall()
    }

    spiders = []
    for row in rows:
        rates = failure_rates.get(row.spider, {"total": 0, "failed": 0})
        fail_pct = (rates["failed"] / rates["total"] * 100) if rates["total"] > 0 else 0
        spiders.append(
            {
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
            }
        )

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


@router.post("/matches/refresh")
async def refresh_matches(db: AsyncSession = Depends(get_db)):
    """Legacy family matching is read-only after canonical model backfill."""
    raise HTTPException(
        status_code=410,
        detail="Legacy match generation is disabled; use model mapping reviews",
    )


@router.post("/matches/{match_id}/{action}")
async def review_product_match(
    match_id: int,
    action: str,
    db: AsyncSession = Depends(get_db),
):
    """Legacy family matching is read-only after canonical model backfill."""
    raise HTTPException(
        status_code=410,
        detail="Legacy match mutation is disabled; use model mapping reviews",
    )


@router.get("/product-models")
async def product_models(
    category_id: str | None = None,
    status: str | None = Query(
        default=None, pattern="^(provisional|verified|archived)$"
    ),
    q: str | None = Query(default=None, min_length=2, max_length=100),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await list_product_models(
        db,
        category_id=category_id,
        status=status,
        query=q,
        limit=limit,
        offset=offset,
    )


@router.post("/product-models", status_code=201)
async def add_product_model(
    payload: ProductModelCreate,
    actor: str = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await create_product_model(
            db,
            category_id=payload.category_id,
            brand=payload.brand,
            name=payload.name,
            status=payload.status,
            actor=actor,
            reason=payload.reason,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/product-models/{source_model_id}/merge")
async def merge_models(
    source_model_id: UUID,
    payload: ProductModelMerge,
    actor: str = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await merge_product_models(
            db,
            source_model_id=source_model_id,
            target_model_id=payload.target_model_id,
            actor=actor,
            reason=payload.reason,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="Source model not found")
    return result


@router.get("/model-mapping-reviews")
async def mapping_reviews(
    status: str = Query(default="pending", pattern="^(pending|accepted|rejected)$"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await list_mapping_reviews(db, status=status, limit=limit, offset=offset)


@router.post("/model-mapping-reviews/{review_id}/resolve")
async def resolve_model_mapping_review(
    review_id: UUID,
    payload: ModelMappingResolution,
    actor: str = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await resolve_mapping_review(
            db,
            review_id=review_id,
            action=payload.action,
            target_model_id=payload.target_model_id,
            actor=actor,
            reason=payload.reason,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail="Mapping review not found")
    return result


def _get_last_task_result(spider_name: str) -> dict | None:
    """Get the most recent completed task result for a spider from Redis."""
    try:
        import json
        import redis as sync_redis

        r = sync_redis.from_url(CELERY_RESULTS, decode_responses=True)

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
    image_url: AnyHttpUrl | None = None


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

    query = select(Product).options(selectinload(Product.current_prices))

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
    query = (
        query.order_by(Product.updated_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )

    result = await db.execute(query)
    products = result.scalars().unique().all()

    items = []
    for p in products:
        items.append(
            {
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
            }
        )

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
        # AnyHttpUrl serializes to a Url object; ORM expects a plain string
        setattr(product, field, str(value) if value is not None else None)

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
    from app.models.product import Product, CurrentPrice, PriceHistory

    uuids = [UUID(pid) for pid in product_ids]

    # Get canonical_ids for cache invalidation
    result = await db.execute(select(Product.canonical_id).where(Product.id.in_(uuids)))
    canonical_ids = [r[0] for r in result.all()]

    await db.execute(sa_delete(PriceHistory).where(PriceHistory.product_id.in_(uuids)))
    await db.execute(sa_delete(CurrentPrice).where(CurrentPrice.product_id.in_(uuids)))
    del_result = await db.execute(sa_delete(Product).where(Product.id.in_(uuids)))
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
    from app.models.product import Product, CurrentPrice, PriceHistory

    pid = UUID(product_id)
    result = await db.execute(select(Product).where(Product.id == pid))
    product = result.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    canonical_id = product.canonical_id

    await db.execute(sa_delete(PriceHistory).where(PriceHistory.product_id == pid))
    # Delete current_prices first (may not cascade depending on DB setup)
    await db.execute(sa_delete(CurrentPrice).where(CurrentPrice.product_id == pid))
    await db.delete(product)
    await db.commit()

    _invalidate_product_cache(canonical_id)

    return {"id": product_id, "deleted": True}


def _invalidate_product_cache(canonical_id: str | None):
    """Invalidate Redis cache for a product."""
    try:
        import redis as sync_redis

        r = sync_redis.from_url(settings.CACHE_REDIS_URL, decode_responses=True)
        if canonical_id:
            r.delete(f"product:{canonical_id}")
        # Also clear list and filter caches
        for pattern in ("products:list:*", "filters:*"):
            for key in r.scan_iter(match=pattern, count=100):
                r.delete(key)
    except Exception:
        logger.debug("Could not invalidate Redis cache")

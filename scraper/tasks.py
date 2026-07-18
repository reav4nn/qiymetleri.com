import logging
import os
import re
import subprocess
import time
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import redis
from croniter import croniter
from sqlalchemy import create_engine, text

from celery_app import app

logger = logging.getLogger(__name__)
SPIDER_ORDER = ("kontakt_home", "baku_electronics", "irshad_electronics", "ispace")
VALID_SPIDERS = frozenset(SPIDER_ORDER)


def _database_url() -> str:
    url = os.environ["DATABASE_URL"]
    return url.replace("postgresql+asyncpg://", "postgresql://", 1).replace("postgresql+psycopg://", "postgresql://", 1)


def _redis_url(database: int) -> str:
    explicit = os.getenv("CACHE_REDIS_URL" if database == 0 else ("CELERY_BROKER_URL" if database == 1 else "CELERY_RESULT_BACKEND"))
    if explicit:
        return explicit
    base = os.getenv("REDIS_URL", "redis://redis:6379/0")
    return re.sub(r"/\d+(?:\?.*)?$", f"/{database}", base)


def _next_run(
    schedule_type: str,
    interval_minutes: int | None,
    cron_expression: str | None,
    now: datetime,
    timezone_name: str = "Asia/Baku",
) -> datetime:
    if schedule_type == "interval":
        return now + timedelta(minutes=interval_minutes or 60)
    local_now = now.astimezone(ZoneInfo(timezone_name))
    return croniter(cron_expression, local_now).get_next(datetime).astimezone(timezone.utc)


@app.task(bind=True, max_retries=2, default_retry_delay=300, name="tasks.crawl_spider")
def crawl_spider(self, spider_name: str, run_id: int | None = None, trigger: str = "manual") -> dict:
    if spider_name not in VALID_SPIDERS:
        raise ValueError(f"Unknown spider: {spider_name}")

    cache = redis.from_url(_redis_url(0), decode_responses=True)
    lock = cache.lock(f"scraper:lock:{spider_name}", timeout=7200, blocking_timeout=0)
    if not lock.acquire(blocking=False):
        if run_id:
            _finish_run(run_id, "conflict", "Bu scraper artıq işləyir")
        return {"spider": spider_name, "status": "conflict", "items": 0}

    start = time.monotonic()
    if run_id is None:
        run_id = _create_run(spider_name, self.request.id, trigger)
    _mark_running(run_id, self.request.retries + 1)
    try:
        result = subprocess.run(
            ["scrapy", "crawl", spider_name], capture_output=True, text=True, timeout=3600,
            env={**os.environ, "SCRAPER_RUN_ID": str(run_id),
                 "SCRAPY_SETTINGS_MODULE": "qiymetleri_scraper.settings", "PYTHONPATH": "/app"},
        )
        elapsed = round(time.monotonic() - start, 1)
        item_count = _extract_item_count(result.stderr)
        log_tail = _safe_log_tail(result.stderr)
        status = _read_run_status(run_id)
        if result.returncode != 0 or item_count == 0 or status == "failed":
            message = "Scraper heç bir məhsul saxlamadı" if item_count == 0 else f"Scraper {result.returncode} kodu ilə dayandı"
            _finish_run(run_id, "failed", message, log_tail, elapsed)
            if self.request.retries < self.max_retries:
                raise self.retry(exc=RuntimeError(message))
            return {"spider": spider_name, "run_id": run_id, "status": "failed", "items": item_count, "elapsed_seconds": elapsed}
        _set_log(run_id, log_tail)
        return {"spider": spider_name, "run_id": run_id, "status": status, "items": item_count, "elapsed_seconds": elapsed}
    except subprocess.TimeoutExpired as exc:
        _finish_run(run_id, "failed", "Scraper 60 dəqiqə limitini keçdi")
        raise self.retry(exc=exc)
    finally:
        try:
            lock.release()
        except redis.exceptions.LockError:
            pass


@app.task(name="tasks.crawl_all_spiders")
def crawl_all_spiders() -> dict:
    tasks = {}
    for spider in SPIDER_ORDER:
        task_id = app.send_task("tasks.crawl_spider", args=[spider, None, "manual"], queue="scraping").id
        tasks[spider] = task_id
    return tasks


@app.task(name="tasks.dispatch_due_spiders")
def dispatch_due_spiders() -> dict:
    now = datetime.now(timezone.utc)
    cache = redis.from_url(_redis_url(0), decode_responses=True)
    cache.set("scraper:beat:heartbeat", now.isoformat(), ex=180)
    dispatched = []
    engine = create_engine(_database_url())
    with engine.begin() as connection:
        rows = connection.execute(text("""
            SELECT spider, schedule_type, interval_minutes, cron_expression, timezone
            FROM scraper_configs WHERE is_enabled=TRUE AND next_run_at <= :now
            ORDER BY next_run_at FOR UPDATE SKIP LOCKED
        """), {"now": now}).all()
        for row in rows:
            if cache.exists(f"scraper:lock:{row.spider}"):
                continue
            task_id = app.uuid()
            run_id = connection.execute(text("""
                INSERT INTO scraper_runs (task_id, spider, trigger, status, started_at)
                VALUES (:task_id, :spider, 'scheduled', 'queued', :now) RETURNING id
            """), {"task_id": task_id, "spider": row.spider, "now": now}).scalar_one()
            connection.execute(text("""
                UPDATE scraper_configs SET next_run_at=:next, updated_at=:now WHERE spider=:spider
            """), {"next": _next_run(row.schedule_type, row.interval_minutes, row.cron_expression, now, row.timezone), "now": now, "spider": row.spider})
            app.send_task("tasks.crawl_spider", args=[row.spider, run_id, "scheduled"], task_id=task_id, queue="scraping")
            dispatched.append(row.spider)
    engine.dispose()
    return {"dispatched": dispatched}


def _create_run(spider: str, task_id: str, trigger: str) -> int:
    engine = create_engine(_database_url())
    with engine.begin() as connection:
        run_id = connection.execute(text("""
            INSERT INTO scraper_runs (task_id, spider, trigger, status, started_at)
            VALUES (:task_id, :spider, :trigger, 'queued', NOW()) RETURNING id
        """), {"task_id": task_id, "spider": spider, "trigger": trigger}).scalar_one()
    engine.dispose()
    return run_id


def _mark_running(run_id: int, attempt: int) -> None:
    engine = create_engine(_database_url())
    with engine.begin() as connection:
        connection.execute(text("UPDATE scraper_runs SET status='running', attempt=:attempt, started_at=NOW(), finished_at=NULL WHERE id=:id"), {"attempt": attempt, "id": run_id})
    engine.dispose()


def _finish_run(run_id: int, status: str, error: str | None = None, log: str | None = None, duration: float | None = None) -> None:
    engine = create_engine(_database_url())
    with engine.begin() as connection:
        connection.execute(text("""
            UPDATE scraper_runs SET status=:status, error_message=:error,
                log_tail=COALESCE(:log, log_tail), duration_seconds=COALESCE(:duration, duration_seconds), finished_at=NOW()
            WHERE id=:id
        """), {"status": status, "error": error, "log": log, "duration": duration, "id": run_id})
    engine.dispose()


def _set_log(run_id: int, log: str) -> None:
    engine = create_engine(_database_url())
    with engine.begin() as connection:
        connection.execute(text("UPDATE scraper_runs SET log_tail=:log WHERE id=:id"), {"log": log, "id": run_id})
    engine.dispose()


def _read_run_status(run_id: int) -> str:
    engine = create_engine(_database_url())
    with engine.connect() as connection:
        status = connection.execute(text("SELECT status FROM scraper_runs WHERE id=:id"), {"id": run_id}).scalar_one()
    engine.dispose()
    return status


def _extract_item_count(stderr: str) -> int:
    match = re.search(r"'item_scraped_count':\s*(\d+)", stderr)
    return int(match.group(1)) if match else 0


def _safe_log_tail(stderr: str) -> str:
    clean = re.sub(r"(?i)(password|token|authorization|proxy)=[^\s&]+", r"\1=[gizlədildi]", stderr)
    clean = re.sub(
        r"(?i)(password|token|authorization):\s*[^\s]+",
        r"\1: [gizlədildi]",
        clean,
    )
    clean = re.sub(
        r"(redis|postgresql)(?:\+\w+)?://[^\s@]+@",
        r"\1://[gizlədildi]@",
        clean,
    )
    return clean[-65536:]

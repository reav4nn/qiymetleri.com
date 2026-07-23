import logging
import os
import re
import subprocess
import time
import json
import base64
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError, URLError
from urllib.request import (
    HTTPRedirectHandler,
    Request,
    build_opener,
)
from uuid import uuid4
from zoneinfo import ZoneInfo

import redis
from croniter import croniter
from sqlalchemy import create_engine, text

from celery_app import app
from shared.spec_ingestion import OFFICIAL_ADAPTERS

logger = logging.getLogger(__name__)
SPIDER_ORDER = ("kontakt_home", "baku_electronics", "irshad_electronics", "ispace")
VALID_SPIDERS = frozenset(SPIDER_ORDER)


class _RejectRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise HTTPError(newurl, code, "redirects are disabled for official sources", headers, fp)


def _admin_request(path: str, payload: dict | None = None) -> dict:
    base_url = os.getenv("INTERNAL_API_URL", "http://backend:8000").rstrip("/")
    username = os.environ["ADMIN_USER"]
    password = os.environ["ADMIN_PASSWORD"]
    authorization = base64.b64encode(f"{username}:{password}".encode()).decode()
    data = json.dumps(payload).encode() if payload is not None else None
    request = Request(
        f"{base_url}/api/v1/admin{path}",
        data=data,
        headers={
            "Authorization": f"Basic {authorization}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with build_opener(_RejectRedirects()).open(request, timeout=60) as response:
        return json.loads(response.read(2 * 1024 * 1024))


def _official_sources() -> list[dict]:
    try:
        sources = json.loads(os.getenv("OFFICIAL_SPEC_SOURCES", "[]"))
    except json.JSONDecodeError as exc:
        raise ValueError("OFFICIAL_SPEC_SOURCES must be valid JSON") from exc
    if not isinstance(sources, list):
        raise ValueError("OFFICIAL_SPEC_SOURCES must be a JSON array")
    return sources


def _fetch_official_payload(adapter_name: str, source_url: str) -> dict:
    adapter = OFFICIAL_ADAPTERS.get(adapter_name)
    if not adapter:
        raise ValueError(f"Unknown official adapter: {adapter_name}")
    adapter.validate_url(source_url)
    request = Request(
        source_url,
        headers={
            "Accept": "application/json",
            "User-Agent": "qiymetleri-spec-ingestion/1.0",
        },
    )
    with build_opener(_RejectRedirects()).open(request, timeout=45) as response:
        if response.headers.get_content_type() not in {
            "application/json",
            "application/ld+json",
        }:
            raise ValueError("official source did not return JSON")
        payload = json.loads(response.read(5 * 1024 * 1024 + 1))
    if not isinstance(payload, dict):
        raise ValueError("official source JSON root must be an object")
    return payload


@app.task(bind=True, max_retries=3, name="tasks.run_official_adapter")
def run_official_adapter(
    self, adapter_name: str = "all", run_id: int | None = None
) -> dict:
    sources = [
        source
        for source in _official_sources()
        if adapter_name == "all" or source.get("adapter") == adapter_name
    ]
    if not sources:
        raise ValueError(f"No configured official sources for adapter: {adapter_name}")
    engine = create_engine(_database_url())
    if run_id is None:
        with engine.begin() as connection:
            run_id = connection.execute(
                text("""
                    INSERT INTO spec_ingestion_runs
                        (task_id, source_adapter, status, attempt, started_at)
                    VALUES (:task_id, :adapter, 'running', 1, NOW()) RETURNING id
                """),
                {"task_id": self.request.id, "adapter": adapter_name},
            ).scalar_one()
    else:
        with engine.begin() as connection:
            connection.execute(
                text("""
                    UPDATE spec_ingestion_runs SET status='running',
                        attempt=:attempt, started_at=NOW(), finished_at=NULL
                    WHERE id=:id
                """),
                {"attempt": min(self.request.retries + 1, 3), "id": run_id},
            )
    documents = observations = errors = 0
    try:
        for source in sources:
            payload = _fetch_official_payload(source["adapter"], source["url"])
            result = _admin_request(
                "/specs/ingest-official",
                {
                    "adapter": source["adapter"],
                    "source_url": source["url"],
                    "model_id": source["model_id"],
                    "payload": payload,
                },
            )
            documents += int(not result.get("idempotent"))
            observations += (
                int(result.get("accepted", 0))
                + int(result.get("rejected", 0))
                + int(result.get("conflicts", 0))
            )
        with engine.begin() as connection:
            connection.execute(
                text("""
                    UPDATE spec_ingestion_runs SET status='success',
                        documents_count=:documents, observations_count=:observations,
                        errors_count=:errors, error=NULL, finished_at=NOW()
                    WHERE id=:id
                """),
                {
                    "documents": documents,
                    "observations": observations,
                    "errors": errors,
                    "id": run_id,
                },
            )
        return {
            "run_id": run_id,
            "status": "success",
            "documents": documents,
            "observations": observations,
        }
    except (HTTPError, URLError, TimeoutError, ValueError, KeyError) as exc:
        errors += 1
        with engine.begin() as connection:
            connection.execute(
                text("""
                    UPDATE spec_ingestion_runs SET status='failed',
                        errors_count=:errors, error=:error, finished_at=NOW()
                    WHERE id=:id
                """),
                {"errors": errors, "error": str(exc)[:4000], "id": run_id},
            )
        if self.request.retries < self.max_retries:
            delay = (300, 1800, 7200)[self.request.retries]
            raise self.retry(
                exc=exc,
                countdown=delay,
                args=[adapter_name, run_id],
            )
        raise
    finally:
        engine.dispose()


@app.task(name="tasks.run_readiness_scan")
def run_readiness_scan() -> dict:
    return _admin_request("/specs/readiness/scan?limit=500")


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
            task_id = str(uuid4())
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

import os

from celery import Celery

REDIS_FALLBACK = os.getenv("REDIS_URL", "redis://redis:6379/0")
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", REDIS_FALLBACK)
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", REDIS_FALLBACK)

app = Celery(
    "qiymetleri_scraper",
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
    include=["tasks"],
)

app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Baku",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=10,
    worker_concurrency=1,
    result_expires=3600,
)

app.conf.beat_schedule = {
    "dispatch-due-spiders": {"task": "tasks.dispatch_due_spiders", "schedule": 60.0},
}

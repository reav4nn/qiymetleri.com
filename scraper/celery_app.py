import os

from celery import Celery
from celery.schedules import crontab

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

app = Celery(
    "qiymetleri_scraper",
    broker=REDIS_URL,
    backend=REDIS_URL,
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
    "scrape-kontakt-home": {
        "task": "tasks.crawl_spider",
        "schedule": crontab(minute=0, hour="*/2"),
        "args": ("kontakt_home",),
    },
    "scrape-baku-electronics": {
        "task": "tasks.crawl_spider",
        "schedule": crontab(minute=15, hour="*/4"),
        "args": ("baku_electronics",),
    },
    "scrape-irshad-electronics": {
        "task": "tasks.crawl_spider",
        "schedule": crontab(minute=30, hour="*/4"),
        "args": ("irshad_electronics",),
    },
    "scrape-ispace": {
        "task": "tasks.crawl_spider",
        "schedule": crontab(minute=45, hour="*/4"),
        "args": ("ispace",),
    },
}

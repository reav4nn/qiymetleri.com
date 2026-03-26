import logging
import os
import re
import subprocess
import time

from celery_app import app

logger = logging.getLogger(__name__)

VALID_SPIDERS = frozenset({
    "kontakt_home",
    "baku_electronics",
    "irshad_electronics",
    "ispace",
})


@app.task(bind=True, max_retries=2, default_retry_delay=300)
def crawl_spider(self, spider_name: str) -> dict:
    """Run a Scrapy spider via subprocess."""
    if spider_name not in VALID_SPIDERS:
        raise ValueError(f"Unknown spider: {spider_name}")

    logger.info("Starting spider: %s (task_id=%s)", spider_name, self.request.id)
    start = time.monotonic()

    try:
        result = subprocess.run(
            ["scrapy", "crawl", spider_name],
            capture_output=True,
            text=True,
            timeout=600,
            env={**os.environ,
                 "SCRAPY_SETTINGS_MODULE": "qiymetleri_scraper.settings",
                 "PYTHONPATH": "/app"},
        )

        elapsed = round(time.monotonic() - start, 1)
        item_count = _extract_item_count(result.stderr)

        if result.returncode == 0:
            logger.info(
                "Spider %s finished: %d items in %ss",
                spider_name, item_count, elapsed,
            )
            return {
                "spider": spider_name,
                "status": "success",
                "items": item_count,
                "elapsed_seconds": elapsed,
            }
        else:
            logger.error(
                "Spider %s failed (exit %d): %s",
                spider_name, result.returncode, result.stderr[-500:],
            )
            raise self.retry(
                exc=RuntimeError(f"Spider {spider_name} exited with {result.returncode}"),
            )

    except subprocess.TimeoutExpired:
        logger.error("Spider %s timed out after 600s", spider_name)
        raise self.retry(exc=TimeoutError(f"Spider {spider_name} timed out"))


@app.task
def crawl_all_spiders() -> dict:
    """Trigger all spiders sequentially."""
    results = {}
    for spider in VALID_SPIDERS:
        result = crawl_spider.delay(spider)
        results[spider] = result.id
    return results


def _extract_item_count(stderr: str) -> int:
    """Extract item_scraped_count from Scrapy log output."""
    match = re.search(r"'item_scraped_count':\s*(\d+)", stderr)
    if match:
        return int(match.group(1))
    return 0

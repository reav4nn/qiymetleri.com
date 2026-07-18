import os

BOT_NAME = "qiymetleri_scraper"

SPIDER_MODULES = ["qiymetleri_scraper.spiders"]
NEWSPIDER_MODULE = "qiymetleri_scraper.spiders"

# Crawl responsibly
ROBOTSTXT_OBEY = True
USER_AGENT = "qiymetleri.com price comparison bot (+https://qiymetleri.com)"

# Concurrency
CONCURRENT_REQUESTS = 8
DOWNLOAD_DELAY = 1.5
RANDOMIZE_DOWNLOAD_DELAY = True
CONCURRENT_REQUESTS_PER_DOMAIN = 4

# Retry
RETRY_ENABLED = True
RETRY_TIMES = 3
RETRY_HTTP_CODES = [500, 502, 503, 504, 408, 429]

# Proxy rotation (BrightData) — activated via PROXY_ENABLED=true env var
DOWNLOADER_MIDDLEWARES = {
    "qiymetleri_scraper.middlewares.proxy_middleware.BrightDataProxyMiddleware": 350,
}

# Playwright settings
DOWNLOAD_HANDLERS = {
    "http": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
    "https": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
}
TWISTED_REACTOR = "twisted.internet.asyncioreactor.AsyncioSelectorReactor"

PLAYWRIGHT_BROWSER_TYPE = "chromium"
PLAYWRIGHT_LAUNCH_OPTIONS = {
    "headless": True,
}
PLAYWRIGHT_DEFAULT_NAVIGATION_TIMEOUT = 30000
PLAYWRIGHT_CONTEXTS = {
    "default": {
        "viewport": {"width": 1366, "height": 768},
        "locale": "az-AZ",
        "timezone_id": "Asia/Baku",
    }
}

# Pipelines
ITEM_PIPELINES = {
    "qiymetleri_scraper.pipelines.price_pipeline.PriceCleaningPipeline": 100,
    "qiymetleri_scraper.pipelines.db_pipeline.DatabasePipeline": 300,
}

# Database — always set DATABASE_URL in production
DATABASE_URL = os.getenv("DATABASE_URL", "")
if not DATABASE_URL:
    _pg_pass = os.getenv("POSTGRES_PASSWORD")
    if not _pg_pass:
        raise RuntimeError("Set DATABASE_URL or POSTGRES_PASSWORD env var before running scrapers.")
    _pg_user = os.getenv("POSTGRES_USER", "qiymetleri")
    _pg_host = os.getenv("POSTGRES_HOST", "localhost")
    _pg_port = os.getenv("POSTGRES_PORT", "5432")
    _pg_db = os.getenv("POSTGRES_DB", "qiymetleri")
    DATABASE_URL = f"postgresql://{_pg_user}:{_pg_pass}@{_pg_host}:{_pg_port}/{_pg_db}"

# Redis (for cache invalidation)
CACHE_REDIS_URL = os.getenv(
    "CACHE_REDIS_URL", os.getenv("REDIS_URL", "redis://redis:6379/0")
)

# Logging
LOG_LEVEL = "INFO"
LOG_FORMAT = "%(asctime)s [%(name)s] %(levelname)s: %(message)s"

# AutoThrottle
AUTOTHROTTLE_ENABLED = True
AUTOTHROTTLE_START_DELAY = 1
AUTOTHROTTLE_MAX_DELAY = 10
AUTOTHROTTLE_TARGET_CONCURRENCY = 2.0

# Request fingerprinting
REQUEST_FINGERPRINTER_IMPLEMENTATION = "2.7"
FEED_EXPORT_ENCODING = "utf-8"

"""
BrightData proxy rotation middleware for Scrapy + Playwright.

Reads proxy credentials from environment variables.
When PROXY_ENABLED=true and credentials are set, all requests
go through BrightData's residential proxy with automatic IP rotation.

If proxy is not configured, requests go direct (development mode).
"""

import logging
import os
import random
import string

from scrapy import signals
from scrapy.exceptions import NotConfigured

logger = logging.getLogger(__name__)


class BrightDataProxyMiddleware:
    """
    Injects BrightData residential proxy into Scrapy requests.

    For Playwright requests, sets proxy at the browser context level
    via PLAYWRIGHT_CONTEXTS settings. For regular HTTP requests,
    sets the standard `proxy` meta key.

    BrightData super proxy handles IP rotation on their side —
    each request gets a different residential IP automatically.
    For sticky sessions (same IP across requests), a session ID
    is appended to the username.

    Environment variables:
        PROXY_ENABLED       - "true" to enable (default: "false")
        PROXY_HOST          - BrightData host (default: brd.superproxy.io)
        PROXY_PORT          - BrightData port (default: 22225)
        PROXY_USERNAME      - Format: brd-customer-XXXX-zone-XXXX
        PROXY_PASSWORD      - Zone password
        PROXY_COUNTRY       - Target country code (default: az)
    """

    def __init__(self, proxy_url, proxy_config):
        self.proxy_url = proxy_url
        self.proxy_config = proxy_config
        self.request_count = 0
        self.blocked_count = 0

    @classmethod
    def from_crawler(cls, crawler):
        enabled = os.getenv("PROXY_ENABLED", "false").lower() == "true"
        if not enabled:
            logger.info("Proxy disabled (PROXY_ENABLED != true). Direct connections.")
            raise NotConfigured("Proxy not enabled")

        username = os.getenv("PROXY_USERNAME", "")
        password = os.getenv("PROXY_PASSWORD", "")
        if not username or not password:
            logger.warning("PROXY_USERNAME/PROXY_PASSWORD not set. Proxy disabled.")
            raise NotConfigured("Proxy credentials missing")

        host = os.getenv("PROXY_HOST", "brd.superproxy.io")
        port = os.getenv("PROXY_PORT", "22225")
        country = os.getenv("PROXY_COUNTRY", "az")

        # Append country targeting to username
        full_username = f"{username}-country-{country}"
        proxy_url = f"http://{full_username}:{password}@{host}:{port}"

        proxy_config = {
            "server": f"http://{host}:{port}",
            "username": full_username,
            "password": password,
        }

        middleware = cls(proxy_url, proxy_config)

        # Inject proxy into Playwright contexts
        cls._configure_playwright_proxy(crawler, proxy_config)

        crawler.signals.connect(middleware.spider_opened, signal=signals.spider_opened)
        crawler.signals.connect(middleware.spider_closed, signal=signals.spider_closed)

        logger.info(
            "BrightData proxy enabled: %s:%s (country=%s)",
            host,
            port,
            country,
        )
        return middleware

    @staticmethod
    def _configure_playwright_proxy(crawler, proxy_config):
        """Inject proxy into all Playwright browser contexts."""
        contexts = crawler.settings.getdict("PLAYWRIGHT_CONTEXTS", {})
        for ctx_name in contexts:
            contexts[ctx_name]["proxy"] = proxy_config

        # Also set proxy in launch options for default context
        launch_options = crawler.settings.getdict("PLAYWRIGHT_LAUNCH_OPTIONS", {})
        launch_options["proxy"] = proxy_config
        crawler.settings.set(
            "PLAYWRIGHT_LAUNCH_OPTIONS", launch_options, priority="cmdline"
        )
        crawler.settings.set("PLAYWRIGHT_CONTEXTS", contexts, priority="cmdline")

    @staticmethod
    def _generate_session_id(length=8):
        """Generate random session ID for sticky IP sessions."""
        return "".join(random.choices(string.ascii_lowercase + string.digits, k=length))

    def process_request(self, request, spider):
        self.request_count += 1

        # For non-Playwright requests, set proxy via meta
        if not request.meta.get("playwright"):
            request.meta["proxy"] = self.proxy_url

        return None

    def process_response(self, request, response, spider):
        if response.status in (403, 407, 429, 503):
            self.blocked_count += 1
            logger.warning(
                "Possible block detected: %s (status %d, blocked %d/%d)",
                request.url,
                response.status,
                self.blocked_count,
                self.request_count,
            )
        return response

    def process_exception(self, request, exception, spider):
        logger.warning(
            "Request failed via proxy: %s — %s",
            request.url,
            str(exception)[:200],
        )
        return None

    def spider_opened(self, spider):
        logger.info(
            "Proxy middleware active for spider: %s",
            spider.name,
        )

    def spider_closed(self, spider):
        if self.request_count > 0:
            block_rate = (self.blocked_count / self.request_count) * 100
            logger.info(
                "Proxy stats for %s: %d requests, %d blocked (%.1f%%)",
                spider.name,
                self.request_count,
                self.blocked_count,
                block_rate,
            )

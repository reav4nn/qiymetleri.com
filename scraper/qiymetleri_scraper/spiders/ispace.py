"""
iSpace spider — scrapes Apple product listings from ispace.az

Vue.js app.  No pagination — all products rendered on category pages.
Brand is always Apple.
Categories covered (MVP): iPhones, Macs, AirPods, Apple Watches.
"""

import re
from datetime import datetime, timezone

import scrapy
from scrapy_playwright.page import PageMethod

from qiymetleri_scraper.items import ProductItem

CATEGORY_URLS = {
    "smartphones": "/category/iphone",
    "laptops": "/category/mac",
    "headphones": "/category/airpods",
    "smartwatches": "/category/apple-watch",
}

# Patterns that indicate an accessory, not the main product category
_ACCESSORY_PATTERNS = [
    r"\bmouse\b", r"\bkeyboard\b", r"\bklaviatura\b",
    r"\bcharger\b", r"\badapter\b", r"\bşarj\b", r"\bqidalanma\b",
    r"\bçoxportlu\b", r"\bconnector\b", r"\bhub\b", r"\bdock\b",
    r"\bcase\b", r"\bcover\b", r"\bfolio\b", r"\bsleeve\b",
    r"\bcable\b", r"\bkabel\b", r"\bglass\b", r"\bfilm\b",
    r"\bpencil\b", r"\bstylus\b", r"\btrackpad\b",
    r"\bearPods\b", r"\bearpods\b",  # EarPods on Mac page
]


class ISpaceSpider(scrapy.Spider):
    name = "ispace"
    allowed_domains = ["ispace.az"]
    store_id = "ispace"

    custom_settings = {
        "DOWNLOAD_DELAY": 2,
        "CONCURRENT_REQUESTS_PER_DOMAIN": 2,
    }

    async def start(self):
        base_url = "https://ispace.az"
        for category, path in CATEGORY_URLS.items():
            yield scrapy.Request(
                url=f"{base_url}{path}",
                callback=self.parse_listing,
                meta={
                    "playwright": True,
                    "playwright_include_page": True,
                    "playwright_page_methods": [
                        PageMethod(
                            "wait_for_selector",
                            ".carousel-product",
                            timeout=20000,
                        ),
                    ],
                    "playwright_page_goto_kwargs": {
                        "wait_until": "domcontentloaded",
                    },
                    "category": category,
                },
                cb_kwargs={"category": category},
                errback=self.errback_close_page,
            )

    async def parse_listing(self, response, category: str):
        self.crawler.stats.inc_value(f"category/{category}/pages")
        page = response.meta.get("playwright_page")

        try:
            product_cards = response.css(".carousel-product")

            self.logger.info(
                f"[iSpace] {len(product_cards)} products in {category} "
                f"on {response.url}"
            )

            for card in product_cards:
                item = ProductItem()
                item["store_id"] = self.store_id
                item["category"] = category
                item["scraped_at"] = datetime.now(timezone.utc).isoformat()

                # Name: .entity-card_name
                name = (
                    card.css(".entity-card_name::attr(data-title)").get()
                    or card.css(".entity-card_name-text::text").get()
                    or ""
                ).strip()

                if not name or len(name) < 3:
                    continue

                # Filter out accessories mixed into category pages
                name_lower = name.lower()
                is_accessory = any(
                    re.search(p, name_lower) for p in _ACCESSORY_PATTERNS
                )
                if is_accessory:
                    self.logger.debug(
                        f"[iSpace] Skipped accessory: '{name}' in {category}"
                    )
                    continue

                item["original_title"] = name

                # Price: .carousel-product_price-value
                price_text = (
                    card.css(
                        ".carousel-product_price-value::text"
                    ).get()
                    or ""
                ).strip()
                item["price_raw"] = price_text

                # URL: <a> with href containing /product/
                link = card.css("a[href*='/product/']::attr(href)").get()
                if link:
                    item["url"] = response.urljoin(link)

                # Brand is always Apple
                item["brand"] = "apple"

                # Image: .entity-card_image src
                img = card.css(
                    ".entity-card_image::attr(src)"
                ).get()
                if not img:
                    img = card.css("img::attr(src)").get()
                if img and "icon" not in img and "svg" not in img:
                    item["image_url"] = response.urljoin(img)

                # Assume in stock
                item["in_stock"] = True

                yield item
        finally:
            if page:
                await page.close()

    async def errback_close_page(self, failure):
        page = failure.request.meta.get("playwright_page")
        if page:
            await page.close()
        self.logger.error(f"Request failed: {failure.value}")
        category = failure.request.meta.get("category", "unknown")
        self.crawler.stats.inc_value(f"category/{category}/errors")

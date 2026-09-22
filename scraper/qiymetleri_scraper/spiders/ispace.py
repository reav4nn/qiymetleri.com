"""
iSpace spider — scrapes Apple product listings from ispace.az

Vue.js app.  No pagination — all products rendered on category pages.
Brand is always Apple.
Categories covered (MVP): iPhones, Macs, AirPods, Apple Watches.
"""

import json
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
        "DOWNLOAD_DELAY": 1,
        "CONCURRENT_REQUESTS_PER_DOMAIN": 4,
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
            # 1. Prefer ItemList JSON-LD schema from category page
            itemlist_urls = []
            for script in response.css('script[type="application/ld+json"]::text').getall():
                try:
                    data = json.loads(script)
                    if data.get("@type") == "ItemList":
                        for elem in data.get("itemListElement", []):
                            if isinstance(elem, dict) and elem.get("url"):
                                itemlist_urls.append(elem["url"])
                except Exception:
                    pass

            if itemlist_urls:
                self.logger.info(
                    f"[iSpace] Found {len(itemlist_urls)} products via ItemList in {category}"
                )
                for url in itemlist_urls:
                    yield scrapy.Request(
                        url=url,
                        callback=self.parse_product,
                        cb_kwargs={"category": category},
                    )
                return

            # 2. Fallback to scraping carousel product cards
            product_cards = response.css(".carousel-product")
            self.logger.info(
                f"[iSpace] {len(product_cards)} products in {category} on {response.url}"
            )

            for card in product_cards:
                name = (
                    card.css(".entity-card_name::attr(data-title)").get()
                    or card.css(".entity-card_name-text::text").get()
                    or ""
                ).strip()

                if not name or len(name) < 3:
                    continue

                name_lower = name.lower()
                if any(re.search(p, name_lower) for p in _ACCESSORY_PATTERNS):
                    continue

                price_text = (
                    card.css(".carousel-product_price-value::text").get() or ""
                ).strip()

                link = card.css("a[href*='/product/']::attr(href)").get()
                img = card.css(".entity-card_image::attr(src)").get() or card.css("img::attr(src)").get()

                item = ProductItem()
                item["store_id"] = self.store_id
                item["category"] = category
                item["scraped_at"] = datetime.now(timezone.utc).isoformat()
                item["original_title"] = name
                item["price_raw"] = price_text
                if link:
                    item["url"] = response.urljoin(link)
                item["brand"] = "apple"
                if img and "icon" not in img and "svg" not in img:
                    item["image_url"] = response.urljoin(img)
                item["in_stock"] = True
                yield item
        finally:
            if page:
                await page.close()

    def parse_product(self, response, category: str):
        for script in response.css('script[type="application/ld+json"]::text').getall():
            try:
                data = json.loads(script)
                if data.get("@type") == "Product":
                    name = data.get("name", "").strip()
                    if not name:
                        continue
                    name_lower = name.lower()
                    if any(re.search(p, name_lower) for p in _ACCESSORY_PATTERNS):
                        continue

                    offers = data.get("offers")
                    if not offers or not isinstance(offers, dict):
                        continue

                    price = str(offers.get("price", "")).strip()
                    if not price:
                        continue

                    avail = str(offers.get("availability", ""))
                    in_stock = "InStock" in avail

                    item = ProductItem()
                    item["store_id"] = self.store_id
                    item["category"] = category
                    item["scraped_at"] = datetime.now(timezone.utc).isoformat()
                    item["original_title"] = name
                    item["price_raw"] = f"{price} ₼"
                    item["url"] = offers.get("url") or response.url
                    item["brand"] = "apple"
                    item["image_url"] = data.get("image") or ""
                    item["in_stock"] = in_stock
                    yield item
                    return
            except Exception:
                pass

    async def errback_close_page(self, failure):
        page = failure.request.meta.get("playwright_page")
        if page:
            await page.close()
        self.logger.error(f"Request failed: {failure.value}")
        category = failure.request.meta.get("category", "unknown")
        self.crawler.stats.inc_value(f"category/{category}/errors")

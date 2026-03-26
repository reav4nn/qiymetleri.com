"""
Kontakt Home spider — scrapes product listings from kontakt.az

Uses Playwright for JS-rendered content.
Categories covered (MVP): Smartphones, Laptops, Headphones, Smartwatches.
"""

import re
from datetime import datetime, timezone

import scrapy
from scrapy_playwright.page import PageMethod

from qiymetleri_scraper.items import ProductItem

CATEGORY_URLS = {
    "smartphones": "/telefonlar-ve-qadjetler/smartfonlar/",
    "laptops": "/kompyuterlər/notbuklar/",
    "headphones": "/aksessuarlar/qulaqciqlar/",
    "smartwatches": "/telefonlar-ve-qadjetler/smart-saatlar-ve-fitness-qolbaqlari/",
}


class KontaktHomeSpider(scrapy.Spider):
    name = "kontakt_home"
    allowed_domains = ["kontakt.az"]
    store_id = "kontakt_home"

    custom_settings = {
        "DOWNLOAD_DELAY": 2,
        "CONCURRENT_REQUESTS_PER_DOMAIN": 2,
    }

    def start_requests(self):
        base_url = "https://kontakt.az"
        for category, path in CATEGORY_URLS.items():
            yield scrapy.Request(
                url=f"{base_url}{path}",
                callback=self.parse_listing,
                meta={
                    "playwright": True,
                    "playwright_include_page": True,
                    "playwright_page_methods": [
                        PageMethod("wait_for_selector", ".product-card, .product-item, [class*='product']", timeout=15000),
                    ],
                    "category": category,
                },
                cb_kwargs={"category": category},
                errback=self.errback_close_page,
            )

    async def parse_listing(self, response, category: str):
        page = response.meta.get("playwright_page")

        try:
            # Try common product card selectors
            product_cards = response.css(
                ".product-card, .product-item, "
                "[class*='ProductCard'], [class*='product-card'], "
                ".catalog-item, .products-item"
            )

            if not product_cards:
                # Fallback: try to find any elements with price-like content
                product_cards = response.css("[class*='product']")

            self.logger.info(
                f"Found {len(product_cards)} products in {category} on {response.url}"
            )

            for card in product_cards:
                item = ProductItem()
                item["store_id"] = self.store_id
                item["category"] = category
                item["scraped_at"] = datetime.now(timezone.utc).isoformat()

                # Extract product name
                name = (
                    card.css("[class*='name'] ::text").get()
                    or card.css("[class*='title'] ::text").get()
                    or card.css("h3 ::text, h4 ::text, a::text").get()
                    or ""
                ).strip()

                if not name or len(name) < 3:
                    continue

                item["original_title"] = name

                # Extract price
                price_text = (
                    card.css("[class*='price'] ::text").get()
                    or card.css("[class*='Price'] ::text").get()
                    or ""
                ).strip()
                item["price_raw"] = price_text

                # Extract URL
                link = card.css("a::attr(href)").get()
                if link:
                    item["url"] = response.urljoin(link)

                # Extract brand from title
                item["brand"] = self._extract_brand(name)

                # Extract image
                img = (
                    card.css("img::attr(src)").get()
                    or card.css("img::attr(data-src)").get()
                )
                if img:
                    item["image_url"] = response.urljoin(img)

                # Check stock status
                out_of_stock_el = card.css(
                    "[class*='out-of-stock'], [class*='sold-out'], "
                    "[class*='unavailable']"
                )
                item["in_stock"] = len(out_of_stock_el) == 0

                yield item

            # Handle pagination
            next_page = (
                response.css("a.next::attr(href)").get()
                or response.css("[class*='pagination'] a[rel='next']::attr(href)").get()
                or response.css("a[class*='next']::attr(href)").get()
            )
            if next_page:
                yield scrapy.Request(
                    url=response.urljoin(next_page),
                    callback=self.parse_listing,
                    meta={
                        "playwright": True,
                        "playwright_include_page": True,
                        "playwright_page_methods": [
                            PageMethod("wait_for_selector", ".product-card, .product-item, [class*='product']", timeout=15000),
                        ],
                        "category": category,
                    },
                    cb_kwargs={"category": category},
                    errback=self.errback_close_page,
                )
        finally:
            if page:
                await page.close()

    async def errback_close_page(self, failure):
        page = failure.request.meta.get("playwright_page")
        if page:
            await page.close()
        self.logger.error(f"Request failed: {failure.value}")

    @staticmethod
    def _extract_brand(title: str) -> str | None:
        """Extract brand from product title."""
        known_brands = [
            "apple", "samsung", "xiaomi", "huawei", "honor",
            "oppo", "vivo", "realme", "oneplus", "google",
            "sony", "lg", "asus", "lenovo", "hp", "dell",
            "acer", "msi", "jbl", "marshall", "beats",
            "bose", "sennheiser", "garmin", "fitbit",
        ]
        title_lower = title.lower()
        for brand in known_brands:
            if re.search(rf"\b{re.escape(brand)}\b", title_lower):
                return brand
        return None

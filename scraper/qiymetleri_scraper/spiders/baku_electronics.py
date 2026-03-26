"""
Baku Electronics spider — scrapes product listings from bakuelectronics.az

Uses Playwright for JS-rendered content.
Categories covered (MVP): Smartphones, Laptops, Headphones, Smartwatches.
"""

import re
from datetime import datetime, timezone

import scrapy
from scrapy_playwright.page import PageMethod

from qiymetleri_scraper.items import ProductItem

CATEGORY_URLS = {
    "smartphones": "/phones-and-gadgets/smartphones/",
    "laptops": "/computers-and-office/notebooks/",
    "headphones": "/tv-audio-video/headphones/",
    "smartwatches": "/phones-and-gadgets/smart-watches/",
}


class BakuElectronicsSpider(scrapy.Spider):
    name = "baku_electronics"
    allowed_domains = ["bakuelectronics.az"]
    store_id = "baku_electronics"

    custom_settings = {
        "DOWNLOAD_DELAY": 2,
        "CONCURRENT_REQUESTS_PER_DOMAIN": 2,
    }

    def start_requests(self):
        base_url = "https://bakuelectronics.az"
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
                            ".product-card, .product-item, [class*='product'], .catalog-item",
                            timeout=15000,
                        ),
                    ],
                    "category": category,
                },
                cb_kwargs={"category": category},
                errback=self.errback_close_page,
            )

    async def parse_listing(self, response, category: str):
        page = response.meta.get("playwright_page")

        try:
            product_cards = response.css(
                ".product-card, .product-item, "
                "[class*='ProductCard'], [class*='product-card'], "
                ".catalog-item, .products-item"
            )

            if not product_cards:
                product_cards = response.css("[class*='product']")

            self.logger.info(
                f"Found {len(product_cards)} products in {category} on {response.url}"
            )

            for card in product_cards:
                item = ProductItem()
                item["store_id"] = self.store_id
                item["category"] = category
                item["scraped_at"] = datetime.now(timezone.utc).isoformat()

                name = (
                    card.css("[class*='name'] ::text").get()
                    or card.css("[class*='title'] ::text").get()
                    or card.css("h3 ::text, h4 ::text, a::text").get()
                    or ""
                ).strip()

                if not name or len(name) < 3:
                    continue

                item["original_title"] = name

                price_text = (
                    card.css("[class*='price'] ::text").get()
                    or card.css("[class*='Price'] ::text").get()
                    or ""
                ).strip()
                item["price_raw"] = price_text

                link = card.css("a::attr(href)").get()
                if link:
                    item["url"] = response.urljoin(link)

                item["brand"] = self._extract_brand(name)

                img = (
                    card.css("img::attr(src)").get()
                    or card.css("img::attr(data-src)").get()
                )
                if img:
                    item["image_url"] = response.urljoin(img)

                out_of_stock_el = card.css(
                    "[class*='out-of-stock'], [class*='sold-out'], "
                    "[class*='unavailable']"
                )
                item["in_stock"] = len(out_of_stock_el) == 0

                yield item

            next_page = (
                response.css("a.next::attr(href)").get()
                or response.css(
                    "[class*='pagination'] a[rel='next']::attr(href)"
                ).get()
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
                            PageMethod(
                                "wait_for_selector",
                                ".product-card, .product-item, [class*='product']",
                                timeout=15000,
                            ),
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

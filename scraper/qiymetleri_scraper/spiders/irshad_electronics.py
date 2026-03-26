"""
Irshad Electronics spider — scrapes product listings from irshad.az

Server-rendered HTML with BEM-style CSS classes (product__*).
Categories covered (MVP): Smartphones, Laptops, Headphones, Smartwatches.
"""

import re
from datetime import datetime, timezone

import scrapy
from scrapy_playwright.page import PageMethod

from qiymetleri_scraper.items import ProductItem

CATEGORY_URLS = {
    "smartphones": "/az/telefon-ve-aksesuarlar/mobil-telefonlar",
    "laptops": "/az/notbuk-planset-ve-komputer-texnikasi/notbuklar",
    "headphones": "/az/telefon-ve-aksesuarlar/qulaqliqlar",
    "smartwatches": "/az/telefon-ve-aksesuarlar/smart-saatlar",
}


class IrshadElectronicsSpider(scrapy.Spider):
    name = "irshad_electronics"
    allowed_domains = ["irshad.az"]
    store_id = "irshad_electronics"

    custom_settings = {
        "DOWNLOAD_DELAY": 2,
        "CONCURRENT_REQUESTS_PER_DOMAIN": 2,
    }

    def start_requests(self):
        base_url = "https://irshad.az"
        for category, path in CATEGORY_URLS.items():
            yield scrapy.Request(
                url=f"{base_url}{path}",
                callback=self.parse_listing,
                meta={
                    "playwright": True,
                    "playwright_include_page": True,
                    "playwright_page_goto_kwargs": {
                        "wait_until": "domcontentloaded",
                    },
                    "playwright_page_methods": [
                        PageMethod("wait_for_timeout", 5000),
                        PageMethod(
                            "wait_for_selector",
                            ".product",
                            timeout=20000,
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
            product_cards = response.css("div.product")

            self.logger.info(
                f"[IRSHAD] {len(product_cards)} products in {category} "
                f"on {response.url}"
            )

            for card in product_cards:
                item = ProductItem()
                item["store_id"] = self.store_id
                item["category"] = category
                item["scraped_at"] = datetime.now(timezone.utc).isoformat()

                # Name: .product__name
                name = (
                    card.css(".product__name::text").get() or ""
                ).strip()

                if not name or len(name) < 3:
                    continue

                item["original_title"] = name

                # Price: .new-price is the current sale price,
                # .old-price is the original (strikethrough) price.
                # If no discount, .new-price may not exist — use
                # .product__price__current text as fallback.
                new_price = (
                    card.css(".product__price__current .new-price::text").get()
                    or ""
                ).strip()
                if not new_price:
                    # No discount — try getting the only price shown
                    price_text = (
                        card.css(".product__price__current::text").get() or ""
                    ).strip()
                    new_price = price_text

                item["price_raw"] = new_price

                # URL: link with class product-link
                link = card.css("a.product-link::attr(href)").get()
                if link:
                    item["url"] = response.urljoin(link)

                # Brand
                item["brand"] = self._extract_brand(name)

                # Image
                img = card.css(".product__img img::attr(src)").get()
                if not img:
                    img = card.css(
                        ".product__img img::attr(data-src)"
                    ).get()
                if img and "icon" not in img and "svg" not in img:
                    item["image_url"] = response.urljoin(img)

                # Stock: look for "Stokda var" text
                card_text = " ".join(card.css("::text").getall())
                item["in_stock"] = "Stokda var" in card_text

                yield item

            # Pagination: check for next page links
            next_page = (
                response.css(
                    ".pagination a[rel='next']::attr(href)"
                ).get()
                or response.css("a.page-link[rel='next']::attr(href)").get()
            )
            if next_page:
                yield scrapy.Request(
                    url=response.urljoin(next_page),
                    callback=self.parse_listing,
                    meta={
                        "playwright": True,
                        "playwright_include_page": True,
                        "playwright_page_goto_kwargs": {
                            "wait_until": "domcontentloaded",
                        },
                        "playwright_page_methods": [
                            PageMethod("wait_for_timeout", 5000),
                            PageMethod(
                                "wait_for_selector",
                                ".product",
                                timeout=20000,
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
            "apple", "iphone", "samsung", "xiaomi", "huawei", "honor",
            "oppo", "vivo", "realme", "oneplus", "google", "motorola",
            "sony", "lg", "asus", "lenovo", "hp", "dell",
            "acer", "msi", "jbl", "marshall", "beats",
            "bose", "sennheiser", "garmin", "fitbit",
            "poco", "infinix", "tecno", "nokia", "nothing",
            "haylou", "mibro",
        ]
        title_lower = title.lower()
        for brand in known_brands:
            if re.search(rf"\b{re.escape(brand)}\b", title_lower):
                if brand == "iphone":
                    return "apple"
                return brand
        return None

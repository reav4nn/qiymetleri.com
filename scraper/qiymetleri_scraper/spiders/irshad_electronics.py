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
            # Click "daha çoxuna bax" (show more) until all products loaded
            if page:
                clicks = 0
                while clicks < 30:
                    btn = await page.query_selector(
                        'button:has-text("daha çoxuna bax"), '
                        'a:has-text("daha çoxuna bax")'
                    )
                    if not btn:
                        break
                    try:
                        await btn.click()
                        await page.wait_for_timeout(2000)
                        clicks += 1
                    except Exception:
                        break

            # Extract all products from live DOM (after load-more clicks)
            products_data = []
            if page:
                products_data = await page.evaluate('''
                    () => {
                        const cards = document.querySelectorAll("div.product");
                        return Array.from(cards).map(card => {
                            const nameEl = card.querySelector(".product__name");
                            const name = nameEl ? nameEl.textContent.trim() : "";

                            const newPrice = card.querySelector(".product__price__current .new-price");
                            const priceEl = card.querySelector(".product__price__current");
                            const price = newPrice
                                ? newPrice.textContent.trim()
                                : (priceEl ? priceEl.textContent.trim() : "");

                            const link = card.querySelector("a.product-link");
                            const url = link ? link.href : "";

                            const img = card.querySelector(".product__img img");
                            let imgSrc = "";
                            if (img) {
                                const src = img.currentSrc || img.src || "";
                                if (src && !src.startsWith("data:") &&
                                    !src.includes("icon") && !src.includes(".svg")) {
                                    imgSrc = src;
                                }
                            }

                            const text = card.textContent || "";
                            const inStock = text.includes("Stokda var");

                            return {name, price, url, imgSrc, inStock};
                        });
                    }
                ''')

            self.logger.info(
                f"[IRSHAD] {len(products_data)} products in {category} "
                f"on {response.url}"
            )

            for data in products_data:
                name = data.get("name", "").strip()
                if not name or len(name) < 3:
                    continue

                item = ProductItem()
                item["store_id"] = self.store_id
                item["category"] = category
                item["scraped_at"] = datetime.now(timezone.utc).isoformat()
                item["original_title"] = name
                item["price_raw"] = data.get("price", "")
                item["brand"] = self._extract_brand(name)
                item["in_stock"] = data.get("inStock", False)

                url = data.get("url", "")
                if url:
                    item["url"] = url

                img_src = data.get("imgSrc", "")
                if img_src:
                    item["image_url"] = img_src

                yield item
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

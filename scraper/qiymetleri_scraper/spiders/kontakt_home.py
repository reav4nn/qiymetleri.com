"""
Kontakt Home spider — scrapes product listings from kontakt.az

Uses Playwright for JS-rendered content (Magento / Swissup Breeze theme).
Categories covered (MVP): Smartphones, Laptops, Headphones, Smartwatches.
"""

import json
import re
from datetime import datetime, timezone

import scrapy
from scrapy_playwright.page import PageMethod

from qiymetleri_scraper.items import ProductItem

CATEGORY_URLS = {
    "smartphones": "/telefoniya/smartfonlar",
    "laptops": "/notbuk-ve-kompyuterler/komputerler/notbuklar",
    "headphones": "/saatlar-ve-qulaqliqlar/qulaqliqlar",
    "smartwatches": "/saatlar-ve-qulaqliqlar/saatlar/smart-saatlar",
}


class KontaktHomeSpider(scrapy.Spider):
    name = "kontakt_home"
    allowed_domains = ["kontakt.az"]
    store_id = "kontakt_home"

    custom_settings = {
        "DOWNLOAD_DELAY": 2,
        "CONCURRENT_REQUESTS_PER_DOMAIN": 2,
    }

    async def start(self):
        base_url = "https://kontakt.az"
        for category, path in CATEGORY_URLS.items():
            yield scrapy.Request(
                url=f"{base_url}{path}",
                callback=self.parse_listing,
                meta={
                    "playwright": True,
                    "playwright_include_page": True,
                    "playwright_page_methods": [
                        PageMethod("wait_for_selector", ".product-item", timeout=15000),
                    ],
                    "category": category,
                },
                cb_kwargs={"category": category},
                errback=self.errback_close_page,
            )

    async def parse_listing(self, response, category: str):
        page = response.meta.get("playwright_page")

        try:
            # Extract image URLs from live DOM (after scroll triggered lazy-load)
            live_images = {}
            if page:
                try:
                    live_images = await page.evaluate("""
                        () => {
                            const map = {};
                            document.querySelectorAll('.product-item').forEach((card, i) => {
                                const img = card.querySelector('img.product-image') 
                                         || card.querySelector('a.prodItem__img img');
                                if (img) {
                                    const src = img.currentSrc || img.src || img.getAttribute('data-src') || '';
                                    if (src && !src.startsWith('data:') && !src.includes('icon') && !src.includes('.svg')) {
                                        const gtm = card.getAttribute('data-gtm');
                                        const key = gtm ? JSON.parse(gtm).item_name : i.toString();
                                        map[key] = src;
                                    }
                                }
                            });
                            return map;
                        }
                    """)
                except Exception as e:
                    self.logger.warning(f"Failed to extract live images: {e}")

            product_cards = response.css("div.prodItem.product-item")

            if not product_cards:
                product_cards = response.css(".product-item")

            self.logger.info(
                f"Found {len(product_cards)} products in {category} on {response.url} "
                f"({len(live_images)} live images)"
            )

            for card in product_cards:
                # Primary extraction: data-gtm JSON attribute
                gtm_raw = card.attrib.get("data-gtm", "")
                gtm = {}
                if gtm_raw:
                    try:
                        gtm = json.loads(gtm_raw)
                    except json.JSONDecodeError:
                        pass

                item = ProductItem()
                item["store_id"] = self.store_id
                item["category"] = category
                item["scraped_at"] = datetime.now(timezone.utc).isoformat()

                # Name from data-gtm, fallback to CSS
                name = gtm.get("item_name", "").strip()
                if not name:
                    name = (
                        card.css("a.prodItem__title::text").get()
                        or card.css("a.prodItem__title::attr(title)").get()
                        or card.css("[class*='title'] ::text").get()
                        or ""
                    ).strip()

                if not name or len(name) < 3:
                    continue

                item["original_title"] = name

                # Price from data-gtm (always final/discounted price in AZN)
                price_val = gtm.get("price")
                if price_val is not None:
                    item["price_raw"] = f"{price_val} ₼"
                else:
                    # Fallback: regex from card text
                    all_text = " ".join(card.css("::text").getall())
                    price_match = re.search(r"([\d.,]+)\s*₼", all_text)
                    if price_match:
                        item["price_raw"] = f"{price_match.group(1)} ₼"
                    else:
                        item["price_raw"] = ""

                # Brand from data-gtm, fallback to title extraction
                brand_gtm = gtm.get("item_brand", "").strip().lower()
                item["brand"] = brand_gtm if brand_gtm else self._extract_brand(name)

                # Product URL — prodItem__title link or first product link
                link = (
                    card.css("a.prodItem__title::attr(href)").get()
                    or card.css("a.prodItem__img::attr(href)").get()
                    or card.css("a[href*='kontakt.az/']::attr(href)").get()
                )
                if link and "#" not in link:
                    item["url"] = response.urljoin(link)

                # Image: prefer live DOM (post-scroll), fallback to response HTML
                img = None
                item_name = gtm.get("item_name", "")
                if item_name and item_name in live_images:
                    img = live_images[item_name]
                if not img:
                    img = (
                        card.css("img.product-image::attr(src)").get()
                        or card.css("img.product-image::attr(data-src)").get()
                        or card.css("a.prodItem__img img::attr(src)").get()
                        or card.css("a.prodItem__img img::attr(data-src)").get()
                    )
                if img and "icon" not in img and "svg" not in img and not img.startswith("data:"):
                    item["image_url"] = response.urljoin(img)

                # Stock — assume in stock (kontakt.az typically hides out-of-stock)
                item["in_stock"] = True

                yield item

            # Pagination — Magento standard next page link
            next_page = (
                response.css(".pages-item-next a::attr(href)").get()
                or response.css("a.action.next::attr(href)").get()
            )
            if next_page:
                yield scrapy.Request(
                    url=response.urljoin(next_page),
                    callback=self.parse_listing,
                    meta={
                        "playwright": True,
                        "playwright_include_page": True,
                        "playwright_page_methods": [
                            PageMethod("wait_for_selector", ".product-item", timeout=15000),
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
            "oppo", "vivo", "realme", "oneplus", "google",
            "sony", "lg", "asus", "lenovo", "hp", "dell",
            "acer", "msi", "jbl", "marshall", "beats",
            "bose", "sennheiser", "garmin", "fitbit",
        ]
        title_lower = title.lower()
        for brand in known_brands:
            if re.search(rf"\b{re.escape(brand)}\b", title_lower):
                # Normalize "iphone" to "apple"
                if brand == "iphone":
                    return "apple"
                return brand
        return None

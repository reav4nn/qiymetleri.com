"""
Baku Electronics spider — scrapes product listings from bakuelectronics.az

Next.js app with CSS-module class names (ProductCard_*).
Pagination via ?page=N query parameter.
Categories covered (MVP): Smartphones, Laptops, Headphones, Smartwatches.
"""

import re
from datetime import datetime, timezone
from urllib.parse import urlencode, urlparse, parse_qs, urlunparse

import scrapy
from scrapy_playwright.page import PageMethod

from qiymetleri_scraper.items import ProductItem

CATEGORY_URLS = {
    "smartphones": "/catalog/telefonlar-qadcetler/smartfonlar-mobil-telefonlar",
    "laptops": "/catalog/noutbuklar-komputerler-planshetler/noutbuklar",
    "headphones": "/catalog/telefonlar-qadcetler/qulaqliqlar",
    "smartwatches": "/catalog/telefonlar-qadcetler/smart-saatlar",
}

MAX_PAGES_PER_CATEGORY = 10


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
                    "playwright_page_goto_kwargs": {
                        "wait_until": "domcontentloaded",
                    },
                    "playwright_page_methods": [
                        PageMethod("wait_for_timeout", 5000),
                        PageMethod(
                            "wait_for_selector",
                            "a[class*='ProductCard_Product']",
                            timeout=20000,
                        ),
                        # Scroll to trigger lazy-loaded images
                        PageMethod("evaluate", """
                            async () => {
                                const delay = ms => new Promise(r => setTimeout(r, ms));
                                for (let y = 0; y < document.body.scrollHeight; y += 300) {
                                    window.scrollTo(0, y);
                                    await delay(150);
                                }
                                await delay(1000);
                            }
                        """),
                    ],
                    "category": category,
                    "page_num": 1,
                },
                cb_kwargs={"category": category},
                errback=self.errback_close_page,
            )

    async def parse_listing(self, response, category: str):
        page = response.meta.get("playwright_page")
        page_num = response.meta.get("page_num", 1)

        try:
            # Extract image URLs from live DOM (after scroll triggered lazy-load)
            live_images = {}
            if page:
                try:
                    live_images = await page.evaluate("""
                        () => {
                            const map = {};
                            document.querySelectorAll("a[class*='ProductCard_Product']").forEach((card, i) => {
                                const img = card.querySelector('img');
                                if (img) {
                                    const src = img.currentSrc || img.src || '';
                                    if (src && !src.startsWith('data:') && !src.includes('icon') && !src.includes('.svg')) {
                                        const alt = img.alt || i.toString();
                                        map[alt] = src;
                                    }
                                }
                            });
                            return map;
                        }
                    """)
                except Exception as e:
                    self.logger.warning(f"Failed to extract live images: {e}")

            product_cards = response.css("a[class*='ProductCard_Product']")

            self.logger.info(
                f"[BE] {len(product_cards)} products in {category} "
                f"(page {page_num}) ({len(live_images)} live images)"
            )

            for card in product_cards:
                item = ProductItem()
                item["store_id"] = self.store_id
                item["category"] = category
                item["scraped_at"] = datetime.now(timezone.utc).isoformat()

                # Name: from img alt or title element
                img_el = card.css("img")
                name = ""
                if img_el:
                    name = (img_el.attrib.get("alt") or "").strip()
                if not name:
                    name = (
                        card.css("[class*='ProductTitle'] ::text").get() or ""
                    ).strip()

                if not name or len(name) < 3:
                    continue

                item["original_title"] = name

                # Price: OriginalPrice is the CURRENT selling price
                # DiscountPrice is the pre-discount strikethrough price
                current_price = (
                    card.css("[class*='OriginalPrice'] ::text").get() or ""
                ).strip()
                if not current_price:
                    all_text = " ".join(card.css("::text").getall())
                    match = re.search(r"([\d\s.,]+)\s*₼", all_text)
                    if match:
                        current_price = f"{match.group(1).strip()} ₼"

                item["price_raw"] = current_price

                # URL: href on the <a> card itself
                href = card.attrib.get("href", "")
                if href:
                    item["url"] = response.urljoin(href)

                # Brand extraction
                item["brand"] = self._extract_brand(name)

                # Image: prefer live DOM (post-scroll), fallback to response HTML
                img_src = None
                if name and name in live_images:
                    img_src = live_images[name]
                if not img_src:
                    img_src = (
                        card.css("img::attr(src)").get()
                        or card.css("img::attr(data-src)").get()
                    )
                if img_src and "icon" not in img_src and "svg" not in img_src and not img_src.startswith("data:"):
                    item["image_url"] = response.urljoin(img_src)

                # Assume in stock (out-of-stock items typically hidden)
                item["in_stock"] = True

                yield item

            # Pagination: use ?page=N URL parameter
            if product_cards and page_num < MAX_PAGES_PER_CATEGORY:
                next_page_num = page_num + 1
                parsed = urlparse(response.url)
                params = parse_qs(parsed.query)
                params["page"] = [str(next_page_num)]
                new_query = urlencode(params, doseq=True)
                next_url = urlunparse(parsed._replace(query=new_query))

                yield scrapy.Request(
                    url=next_url,
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
                                "a[class*='ProductCard_Product']",
                                timeout=20000,
                            ),
                            PageMethod("evaluate", """
                                async () => {
                                    const delay = ms => new Promise(r => setTimeout(r, ms));
                                    for (let y = 0; y < document.body.scrollHeight; y += 300) {
                                        window.scrollTo(0, y);
                                        await delay(150);
                                    }
                                    await delay(1000);
                                }
                            """),
                        ],
                        "category": category,
                        "page_num": next_page_num,
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
        ]
        title_lower = title.lower()
        for brand in known_brands:
            if re.search(rf"\b{re.escape(brand)}\b", title_lower):
                if brand == "iphone":
                    return "apple"
                return brand
        return None

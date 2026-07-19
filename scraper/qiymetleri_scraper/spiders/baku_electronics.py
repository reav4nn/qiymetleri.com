"""
Baku Electronics spider — scrapes product listings from bakuelectronics.az

Server-rendered Next.js app with CSS-module class names (ProductCard_*).
Pagination via ?page=N query parameter.
Categories covered (MVP): Smartphones, Laptops, Headphones, Smartwatches.
"""

import re
from datetime import datetime, timezone
from urllib.parse import urlencode, urlparse, parse_qs, urlunparse

import scrapy

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
        "DOWNLOAD_HANDLERS": {
            "http": "scrapy.core.downloader.handlers.http11.HTTP11DownloadHandler",
            "https": "scrapy.core.downloader.handlers.http11.HTTP11DownloadHandler",
        },
    }

    async def start(self):
        base_url = "https://bakuelectronics.az"
        for category, path in CATEGORY_URLS.items():
            yield scrapy.Request(
                url=f"{base_url}{path}",
                callback=self.parse_listing,
                meta={
                    "category": category,
                    "page_num": 1,
                },
                cb_kwargs={"category": category},
                errback=self.errback_request,
            )

    def parse_listing(self, response, category: str):
        self.crawler.stats.inc_value(f"category/{category}/pages")
        page_num = response.meta.get("page_num", 1)

        product_cards = response.css("a[class*='ProductCard_Product']")

        self.logger.info(
            f"[BE] {len(product_cards)} products in {category} (page {page_num})"
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
                name = (card.css("[class*='ProductTitle'] ::text").get() or "").strip()

            if not name or len(name) < 3:
                continue

            item["original_title"] = name

            # OriginalPrice is the current selling price; DiscountPrice is the
            # pre-discount strikethrough price on this site.
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

            item["brand"] = self._extract_brand(name)

            # The server HTML has a data URI placeholder followed by the real
            # image in <noscript>; prefer the real URL explicitly.
            image_candidates = card.css("img::attr(src)").getall()
            img_src = next(
                (src for src in image_candidates if not src.startswith("data:")),
                None,
            )
            if img_src and "icon" not in img_src and ".svg" not in img_src:
                item["image_url"] = response.urljoin(img_src)

            # Out-of-stock products are not emitted as catalogue cards.
            item["in_stock"] = True

            yield item

        # Pagination: use the Next.js catalogue's ?page=N parameter.
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
                meta={"category": category, "page_num": next_page_num},
                cb_kwargs={"category": category},
                errback=self.errback_request,
            )

    def errback_request(self, failure):
        self.logger.error(f"Request failed: {failure.value}")
        category = failure.request.meta.get("category", "unknown")
        self.crawler.stats.inc_value(f"category/{category}/errors")

    @staticmethod
    def _extract_brand(title: str) -> str | None:
        known_brands = [
            "apple",
            "iphone",
            "samsung",
            "xiaomi",
            "huawei",
            "honor",
            "oppo",
            "vivo",
            "realme",
            "oneplus",
            "google",
            "motorola",
            "sony",
            "lg",
            "asus",
            "lenovo",
            "hp",
            "dell",
            "acer",
            "msi",
            "jbl",
            "marshall",
            "beats",
            "bose",
            "sennheiser",
            "garmin",
            "fitbit",
            "poco",
            "infinix",
            "tecno",
            "nokia",
            "nothing",
        ]
        title_lower = title.lower()
        for brand in known_brands:
            if re.search(rf"\b{re.escape(brand)}\b", title_lower):
                if brand == "iphone":
                    return "apple"
                return brand
        return None

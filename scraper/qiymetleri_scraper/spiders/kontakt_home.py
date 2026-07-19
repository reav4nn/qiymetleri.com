"""
Kontakt Home spider — scrapes product listings from kontakt.az

Uses the server-rendered Magento / Swissup Breeze catalogue HTML.
Categories covered (MVP): Smartphones, Laptops, Headphones, Smartwatches.
"""

import json
import re
from datetime import datetime, timezone

import scrapy

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
        "DOWNLOAD_DELAY": 4,
        "CONCURRENT_REQUESTS_PER_DOMAIN": 1,
        # Kontakt serves catalogue HTML to declared crawlers, while its generic
        # Chrome user agent is sent through a Cloudflare browser challenge.
        "USER_AGENT": "qiymetleri.com price comparison bot (+https://qiymetleri.com)",
        "DOWNLOAD_HANDLERS": {
            "http": "scrapy.core.downloader.handlers.http11.HTTP11DownloadHandler",
            "https": "scrapy.core.downloader.handlers.http11.HTTP11DownloadHandler",
        },
    }

    async def start(self):
        base_url = "https://kontakt.az"
        for category, path in CATEGORY_URLS.items():
            yield scrapy.Request(
                url=f"{base_url}{path}",
                callback=self.parse_listing,
                meta={"category": category},
                cb_kwargs={"category": category},
                errback=self.errback_request,
            )

    def parse_listing(self, response, category: str):
        self.crawler.stats.inc_value(f"category/{category}/pages")
        product_cards = response.css("div.prodItem.product-item")
        if not product_cards:
            product_cards = response.css(".product-item")

        self.logger.info(
            f"Found {len(product_cards)} products in {category} on {response.url}"
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

            # Name from data-gtm, fallback to current and legacy CSS.
            name = gtm.get("item_name", "").strip()
            if not name:
                name = (
                    card.css(".prodItem__title::text").get()
                    or card.css("a.prodItem__title::attr(title)").get()
                    or card.css("a.prodItem__img::attr(title)").get()
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

            # Product URL — image link in the current Magento card.
            link = (
                card.css("a.prodItem__title::attr(href)").get()
                or card.css("a.prodItem__img::attr(href)").get()
                or card.css("a[href*='kontakt.az/']::attr(href)").get()
            )
            if link and "#" not in link:
                item["url"] = response.urljoin(link)

            img = (
                card.css("a.prodItem__img picture source::attr(srcset)").get()
                or card.css("a.prodItem__img img.product-image::attr(src)").get()
                or card.css("a.prodItem__img img::attr(data-src)").get()
            )
            if (
                img
                and "icon" not in img
                and ".svg" not in img
                and not img.startswith("data:")
            ):
                item["image_url"] = response.urljoin(img.split()[0])

            # Out-of-stock variants are not emitted as catalogue cards.
            item["in_stock"] = True

            yield item

        # Pagination — Magento standard next page link.
        next_page = (
            response.css(".pages-item-next a::attr(href)").get()
            or response.css("a.action.next::attr(href)").get()
        )
        if next_page:
            yield scrapy.Request(
                url=response.urljoin(next_page),
                callback=self.parse_listing,
                meta={"category": category},
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
        ]
        title_lower = title.lower()
        for brand in known_brands:
            if re.search(rf"\b{re.escape(brand)}\b", title_lower):
                # Normalize "iphone" to "apple"
                if brand == "iphone":
                    return "apple"
                return brand
        return None

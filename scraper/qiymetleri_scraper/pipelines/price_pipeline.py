import re
from urllib.parse import urlparse

from itemadapter import ItemAdapter
from scrapy.exceptions import DropItem


class PriceCleaningPipeline:
    """Clean and normalize price data from scraped items."""

    @classmethod
    def from_crawler(cls, crawler):
        pipeline = cls()
        pipeline.crawler = crawler
        return pipeline

    def process_item(self, item):
        spider = self.crawler.spider
        adapter = ItemAdapter(item)

        title = (adapter.get("original_title") or "").strip()
        url = (adapter.get("url") or "").strip()
        category = adapter.get("category")
        if len(title) < 3:
            raise DropItem("Məhsul adı boş və ya etibarsızdır")
        if not url or not self._is_allowed_url(url, spider.allowed_domains):
            raise DropItem(f"Məhsul URL-i mağaza domeninə aid deyil: {url}")
        if category not in {"smartphones", "laptops", "headphones", "smartwatches"}:
            raise DropItem(f"Naməlum kateqoriya: {category}")

        # Parse price
        price_raw = adapter.get("price_raw", "")
        if price_raw and not adapter.get("price_azn"):
            adapter["price_azn"] = self._parse_price(price_raw)
        if not adapter.get("price_azn") or adapter["price_azn"] <= 0:
            raise DropItem(f"Qiymət etibarsızdır: {price_raw}")

        # Normalize brand
        brand = adapter.get("brand", "")
        if brand:
            adapter["brand"] = brand.strip().lower()

        # Default in_stock to True if not set
        if adapter.get("in_stock") is None:
            adapter["in_stock"] = True

        return item

    @staticmethod
    def _parse_price(price_str: str) -> float | None:
        """Parse Azerbaijani and international price formats."""
        if not price_str:
            return None
        cleaned = re.sub(r"[^\d.,]", "", price_str.replace(" ", ""))
        if not cleaned:
            return None

        if "," in cleaned and "." in cleaned:
            # The right-most separator is the decimal separator.
            decimal = "," if cleaned.rfind(",") > cleaned.rfind(".") else "."
            thousands = "." if decimal == "," else ","
            cleaned = cleaned.replace(thousands, "").replace(decimal, ".")
        elif "," in cleaned:
            left, right = cleaned.rsplit(",", 1)
            cleaned = left.replace(",", "") + (f".{right}" if len(right) <= 2 else right)
        elif "." in cleaned:
            left, right = cleaned.rsplit(".", 1)
            if len(right) == 3 and left:
                cleaned = left.replace(".", "") + right
            else:
                cleaned = left.replace(".", "") + f".{right}"
        try:
            return round(float(cleaned), 2)
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _is_allowed_url(url: str, allowed_domains: list[str]) -> bool:
        hostname = (urlparse(url).hostname or "").lower()
        return any(hostname == domain or hostname.endswith(f".{domain}") for domain in allowed_domains)

import re

from itemadapter import ItemAdapter


class PriceCleaningPipeline:
    """Clean and normalize price data from scraped items."""

    def process_item(self, item, spider):
        adapter = ItemAdapter(item)

        # Parse price
        price_raw = adapter.get("price_raw", "")
        if price_raw and not adapter.get("price_azn"):
            adapter["price_azn"] = self._parse_price(price_raw)

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
        """Parse price string to float. Handles '1 299 ₼', '1299.00', etc."""
        if not price_str:
            return None
        # Remove currency symbols, spaces, and non-numeric chars except . and ,
        cleaned = re.sub(r"[^\d.,]", "", price_str.replace(" ", ""))
        # Handle comma as decimal separator
        if "," in cleaned and "." not in cleaned:
            cleaned = cleaned.replace(",", ".")
        elif "," in cleaned and "." in cleaned:
            cleaned = cleaned.replace(",", "")
        try:
            return round(float(cleaned), 2)
        except (ValueError, TypeError):
            return None

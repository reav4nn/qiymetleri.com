"""Build the mobile real-product fallback from scraper JSON exports.

Usage:
    python scripts/export_mobile_catalogue.py kontakt.json baku.json \
        --output ../mobile/src/data/real-catalogue.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from importlib import import_module
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

normalize_name = import_module("shared.normalizer").normalize_name

STORE_NAMES = {
    "kontakt_home": "Kontakt Home",
    "baku_electronics": "Baku Electronics",
    "irshad_electronics": "İrşad",
    "ispace": "iSpace",
}

TITLE_PREFIXES = (
    "Smartfon ",
    "Telefon ",
    "Noutbuk ",
    "Qulaqlıq ",
    "Qulaqlıqlar ",
    "Smart saat ",
    "Televizor ",
    "Planşet ",
)


def parse_price(value: Any) -> float | None:
    cleaned = re.sub(r"[^\d.,]", "", str(value or "").replace(" ", ""))
    if not cleaned:
        return None
    if "," in cleaned and "." in cleaned:
        decimal = "," if cleaned.rfind(",") > cleaned.rfind(".") else "."
        thousands = "." if decimal == "," else ","
        cleaned = cleaned.replace(thousands, "").replace(decimal, ".")
    elif "," in cleaned:
        left, right = cleaned.rsplit(",", 1)
        cleaned = left.replace(",", "") + (f".{right}" if len(right) <= 2 else right)
    elif "." in cleaned:
        left, right = cleaned.rsplit(".", 1)
        cleaned = left.replace(".", "") + (right if len(right) == 3 else f".{right}")
    try:
        price = round(float(cleaned), 2)
        return price if price > 0 else None
    except ValueError:
        return None


def clean_title(value: str) -> str:
    title = " ".join(value.split()).strip()
    for prefix in TITLE_PREFIXES:
        if title.casefold().startswith(prefix.casefold()):
            return title[len(prefix) :].strip()
    return title


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.casefold()).strip("_")


def canonical_id(item: dict[str, Any], parsed: dict[str, Any]) -> str:
    brand = (item.get("brand") or "unknown").strip().casefold()
    family = parsed.get("model_family")
    if family:
        parts = [brand, str(family)]
        if parsed.get("storage_gb"):
            parts.append(f"{parsed['storage_gb']}gb")
        if parsed.get("color"):
            parts.append(str(parsed["color"]))
        return slug("_".join(parts))[:255]
    return slug(f"{brand}_{clean_title(item.get('original_title') or '')}")[:255]


def load_items(paths: list[Path]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for path in paths:
        with path.open(encoding="utf-8") as stream:
            value = json.load(stream)
        if not isinstance(value, list):
            raise TypeError(f"Expected a JSON array in {path}")
        items.extend(item for item in value if isinstance(item, dict))
    return items


def build_catalogue(items: list[dict[str, Any]]) -> dict[str, Any]:
    grouped: dict[str, dict[str, Any]] = {}
    latest_scrape = ""

    for item in items:
        title = clean_title(item.get("original_title") or "")
        price = parse_price(item.get("price_azn") or item.get("price_raw"))
        store_id = item.get("store_id")
        image_url = item.get("image_url")
        product_url = item.get("url")
        category = item.get("category")
        if not title or not price or store_id not in STORE_NAMES or not category:
            continue
        if not isinstance(image_url, str) or not image_url.startswith("https://"):
            continue
        if not isinstance(product_url, str) or not product_url.startswith("https://"):
            continue

        parsed = normalize_name(title)
        product_id = canonical_id(item, parsed)
        scraped_at = item.get("scraped_at") or datetime.now(timezone.utc).isoformat()
        latest_scrape = max(latest_scrape, scraped_at)
        attributes = {
            key: parsed[key]
            for key in ("storage_gb", "ram_gb", "color", "sku")
            if parsed.get(key) is not None
        }

        product = grouped.setdefault(
            product_id,
            {
                "id": product_id,
                "canonical_id": product_id,
                "brand": (item.get("brand") or "").strip().casefold() or None,
                "category": category,
                "model_family": parsed.get("model_family"),
                "name": title,
                "image_url": image_url,
                "attributes": attributes,
                "offers": {},
            },
        )

        if len(title) < len(product["name"]):
            product["name"] = title
        if not product.get("image_url"):
            product["image_url"] = image_url

        offer = {
            "id": f"{product_id}_{store_id}",
            "store_id": store_id,
            "price_azn": price,
            "original_title": item.get("original_title") or title,
            "url": product_url,
            "in_stock": bool(item.get("in_stock", True)),
            "last_checked_at": scraped_at,
        }
        current_offer = product["offers"].get(store_id)
        if current_offer is None or price < current_offer["price_azn"]:
            product["offers"][store_id] = offer

    products = []
    for product in grouped.values():
        product["offers"] = sorted(
            product["offers"].values(), key=lambda offer: offer["price_azn"]
        )
        products.append(product)
    products.sort(key=lambda product: (product["category"], product["name"].casefold()))

    return {
        "generated_at": latest_scrape or datetime.now(timezone.utc).isoformat(),
        "sources": [
            {"id": store_id, "name": name}
            for store_id, name in STORE_NAMES.items()
            if any(
                any(offer["store_id"] == store_id for offer in product["offers"])
                for product in products
            )
        ],
        "products": products,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("inputs", nargs="+", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    catalogue = build_catalogue(load_items(args.inputs))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8", newline="\n") as stream:
        json.dump(catalogue, stream, ensure_ascii=False, separators=(",", ":"))
        stream.write("\n")

    image_count = sum(bool(product["image_url"]) for product in catalogue["products"])
    print(
        f"Exported {len(catalogue['products'])} real products "
        f"with {image_count} images to {args.output}"
    )


if __name__ == "__main__":
    main()

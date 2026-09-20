"""Seed a deterministic demonstration catalogue.

Usage:
    python -m scripts.seed_demo
"""

import asyncio
import json
import uuid

from sqlalchemy import text

from app.core.cache import invalidate_cache
from app.core.database import AsyncSessionLocal, engine

DEMO_PRODUCTS = (
    (
        "apple_iphone_15_128gb_black",
        "Apple",
        "smartphones",
        "iPhone 15",
        "Apple iPhone 15 128GB Black",
        {"storage_gb": 128, "color": "Black"},
    ),
    (
        "samsung_galaxy_s24_256gb_gray",
        "Samsung",
        "smartphones",
        "Galaxy S24",
        "Samsung Galaxy S24 256GB Gray",
        {"storage_gb": 256, "color": "Gray"},
    ),
    (
        "apple_macbook_air_m3_256gb",
        "Apple",
        "laptops",
        "MacBook Air M3",
        "Apple MacBook Air M3 13-inch 256GB",
        {"storage_gb": 256, "chip": "M3"},
    ),
    (
        "samsung_crystal_uhd_55",
        "Samsung",
        "televisions",
        "Crystal UHD 55",
        "Samsung 55-inch Crystal UHD 4K TV",
        {"size_inch": 55},
    ),
    (
        "sony_wh_1000xm5_black",
        "Sony",
        "headphones",
        "WH-1000XM5",
        "Sony WH-1000XM5 Black",
        {"color": "Black"},
    ),
    (
        "apple_ipad_10_64gb",
        "Apple",
        "tablets",
        "iPad 10",
        "Apple iPad 10.9-inch 64GB Wi-Fi",
        {"storage_gb": 64},
    ),
    (
        "apple_watch_series_9_41mm",
        "Apple",
        "smartwatches",
        "Watch Series 9",
        "Apple Watch Series 9 41mm",
        {"size_mm": 41},
    ),
    (
        "xiaomi_redmi_note_13_pro_256gb",
        "Xiaomi",
        "smartphones",
        "Redmi Note 13 Pro",
        "Xiaomi Redmi Note 13 Pro 256GB",
        {"storage_gb": 256},
    ),
)

DEMO_PRICES = {
    "apple_iphone_15_128gb_black": (
        ("kontakt_home", 1799),
        ("baku_electronics", 1829),
        ("irshad_electronics", 1849),
        ("ispace", 1899),
    ),
    "samsung_galaxy_s24_256gb_gray": (
        ("kontakt_home", 1549),
        ("baku_electronics", 1579),
        ("irshad_electronics", 1599),
    ),
    "apple_macbook_air_m3_256gb": (
        ("kontakt_home", 2299),
        ("baku_electronics", 2349),
        ("ispace", 2399),
    ),
    "samsung_crystal_uhd_55": (
        ("kontakt_home", 1099),
        ("baku_electronics", 1129),
        ("irshad_electronics", 1149),
    ),
    "sony_wh_1000xm5_black": (
        ("kontakt_home", 649),
        ("baku_electronics", 679),
        ("irshad_electronics", 699),
    ),
    "apple_ipad_10_64gb": (
        ("kontakt_home", 899),
        ("baku_electronics", 929),
        ("ispace", 949),
    ),
    "apple_watch_series_9_41mm": (
        ("kontakt_home", 799),
        ("baku_electronics", 829),
        ("ispace", 849),
    ),
    "xiaomi_redmi_note_13_pro_256gb": (
        ("kontakt_home", 569),
        ("baku_electronics", 589),
        ("irshad_electronics", 599),
    ),
}


def stable_uuid(value: str) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_URL, f"https://qiymetleri.com/demo/{value}")


async def seed() -> None:
    async with AsyncSessionLocal() as session:
        for canonical_id, brand, category, family, name, attributes in DEMO_PRODUCTS:
            product_id = stable_uuid(canonical_id)
            await session.execute(
                text("""
                    INSERT INTO products (
                        id, canonical_id, brand, category, model_family, name, attributes
                    ) VALUES (
                        :id, :canonical_id, :brand, :category, :family, :name,
                        CAST(:attributes AS jsonb)
                    )
                    ON CONFLICT (canonical_id) DO UPDATE SET
                        brand = EXCLUDED.brand,
                        category = EXCLUDED.category,
                        model_family = EXCLUDED.model_family,
                        name = EXCLUDED.name,
                        attributes = EXCLUDED.attributes,
                        updated_at = NOW()
                    """),
                {
                    "id": product_id,
                    "canonical_id": canonical_id,
                    "brand": brand.lower(),
                    "category": category,
                    "family": family,
                    "name": name,
                    "attributes": json.dumps(attributes),
                },
            )

            for store_id, price in DEMO_PRICES[canonical_id]:
                price_id = stable_uuid(f"{canonical_id}/{store_id}")
                await session.execute(
                    text("""
                        INSERT INTO current_prices (
                            id, product_id, store_id, price_azn, original_title,
                            url, in_stock, last_checked_at
                        ) VALUES (
                            :id, :product_id, :store_id, :price, :title,
                            :url, TRUE, NOW()
                        )
                        ON CONFLICT (product_id, store_id) DO UPDATE SET
                            price_azn = EXCLUDED.price_azn,
                            original_title = EXCLUDED.original_title,
                            url = EXCLUDED.url,
                            in_stock = TRUE,
                            last_checked_at = NOW()
                        """),
                    {
                        "id": price_id,
                        "product_id": product_id,
                        "store_id": store_id,
                        "price": price,
                        "title": name,
                        "url": f"https://example.com/demo/{canonical_id}/{store_id}",
                    },
                )

                for days_ago, multiplier in ((14, 1.08), (7, 1.04), (0, 1.0)):
                    await session.execute(
                        text("""
                            INSERT INTO price_history (
                                time, product_id, store_id, price_azn, in_stock
                            ) VALUES (
                                date_trunc('day', NOW()) - (:days * INTERVAL '1 day'),
                                :product_id, :store_id, :price, TRUE
                            )
                            ON CONFLICT (time, product_id, store_id) DO UPDATE SET
                                price_azn = EXCLUDED.price_azn,
                                in_stock = TRUE
                            """),
                        {
                            "days": days_ago,
                            "product_id": product_id,
                            "store_id": store_id,
                            "price": round(price * multiplier, 2),
                        },
                    )

        await session.commit()

    try:
        await invalidate_cache("products:*")
        await invalidate_cache("filters:*")
    except Exception:
        pass

    await engine.dispose()
    print(f"Seeded {len(DEMO_PRODUCTS)} demo products.")


if __name__ == "__main__":
    asyncio.run(seed())

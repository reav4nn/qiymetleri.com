"""Seed catalogue database with real products from real-catalogue.json.

Usage:
    python -m scripts.seed_catalogue
"""

import asyncio
from datetime import datetime, timezone
import json
import logging
from pathlib import Path
import uuid

from sqlalchemy import text

from app.core.cache import invalidate_cache
from app.core.database import AsyncSessionLocal, engine

logger = logging.getLogger(__name__)

NAMESPACE_QIYMETLERI = uuid.uuid5(uuid.NAMESPACE_URL, "https://qiymetleri.com/product")


def stable_uuid(value: str) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE_QIYMETLERI, str(value))


async def seed(force: bool = False) -> None:
    data_path = Path(__file__).resolve().parent / "real-catalogue.json"
    if not data_path.exists():
        # Fallback to demo seed
        logger.warning(f"File {data_path} not found. Falling back to seed_demo.")
        from scripts.seed_demo import seed as seed_demo

        await seed_demo()
        return

    with open(data_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    products = data.get("products", [])
    if not products:
        logger.warning("No products found in real-catalogue.json")
        return

    async with AsyncSessionLocal() as session:
        # Check if already populated
        res = await session.execute(text("SELECT COUNT(*) FROM products"))
        count = res.scalar() or 0
        if count > 50 and not force:
            print(
                f"Database already contains {count} products. Skipping seed (use force=True to reseed)."
            )
            return

        print(f"Seeding {len(products)} products into database...")

        # Ensure default stores exist
        default_stores = [
            ("kontakt_home", "Kontakt Home", "https://kontakt.az"),
            ("baku_electronics", "Baku Electronics", "https://bakuelectronics.az"),
            ("irshad_electronics", "Irshad Electronics", "https://irshad.az"),
            ("ispace", "iSpace", "https://ispace.az"),
        ]
        for store_id, name, base_url in default_stores:
            await session.execute(
                text("""
                    INSERT INTO stores (id, name, base_url, is_active)
                    VALUES (:id, :name, :base_url, TRUE)
                    ON CONFLICT (id) DO NOTHING
                """),
                {"id": store_id, "name": name, "base_url": base_url},
            )

        seeded_products = 0
        seeded_prices = 0

        for p in products:
            canonical_id = p.get("canonical_id") or p.get("id")
            if not canonical_id:
                continue

            product_id = stable_uuid(canonical_id)
            brand = (p.get("brand") or "").strip().lower()
            category = (p.get("category") or "").strip().lower()
            model_family = p.get("model_family") or p.get("name") or ""
            name = p.get("name") or canonical_id
            attributes = p.get("attributes") or {}
            image_url = p.get("image_url") or ""

            await session.execute(
                text("""
                    INSERT INTO products (
                        id, canonical_id, brand, category, model_family, name, attributes, image_url
                    ) VALUES (
                        :id, :canonical_id, :brand, :category, :family, :name,
                        CAST(:attributes AS jsonb), :image_url
                    )
                    ON CONFLICT (canonical_id) DO UPDATE SET
                        brand = EXCLUDED.brand,
                        category = EXCLUDED.category,
                        model_family = EXCLUDED.model_family,
                        name = EXCLUDED.name,
                        attributes = EXCLUDED.attributes,
                        image_url = EXCLUDED.image_url,
                        updated_at = NOW()
                """),
                {
                    "id": product_id,
                    "canonical_id": canonical_id,
                    "brand": brand,
                    "category": category,
                    "family": model_family,
                    "name": name,
                    "attributes": json.dumps(attributes),
                    "image_url": image_url,
                },
            )
            seeded_products += 1

            offers = p.get("offers", [])
            for offer in offers:
                store_id = offer.get("store_id")
                price_azn = offer.get("price_azn")
                if not store_id or price_azn is None:
                    continue

                price_id = stable_uuid(f"{canonical_id}/{store_id}")
                original_title = offer.get("original_title") or name
                url = offer.get("url") or ""
                in_stock = offer.get("in_stock", True)
                last_checked = offer.get("last_checked_at")
                if last_checked:
                    try:
                        checked_at = datetime.fromisoformat(last_checked)
                    except (ValueError, TypeError):
                        checked_at = datetime.now(timezone.utc)
                else:
                    checked_at = datetime.now(timezone.utc)

                await session.execute(
                    text("""
                        INSERT INTO current_prices (
                            id, product_id, store_id, price_azn, original_title,
                            url, in_stock, last_checked_at
                        ) VALUES (
                            :id, :product_id, :store_id, :price, :title,
                            :url, :in_stock, :checked_at
                        )
                        ON CONFLICT (product_id, store_id) DO UPDATE SET
                            price_azn = EXCLUDED.price_azn,
                            original_title = EXCLUDED.original_title,
                            url = EXCLUDED.url,
                            in_stock = EXCLUDED.in_stock,
                            last_checked_at = EXCLUDED.last_checked_at
                    """),
                    {
                        "id": price_id,
                        "product_id": product_id,
                        "store_id": store_id,
                        "price": price_azn,
                        "title": original_title,
                        "url": url,
                        "in_stock": in_stock,
                        "checked_at": checked_at,
                    },
                )
                seeded_prices += 1

                # Add sample price history
                for days_ago, multiplier in ((14, 1.05), (7, 1.02), (0, 1.0)):
                    await session.execute(
                        text("""
                            INSERT INTO price_history (
                                time, product_id, store_id, price_azn, in_stock
                            ) VALUES (
                                date_trunc('day', NOW()) - (:days * INTERVAL '1 day'),
                                :product_id, :store_id, :price, :in_stock
                            )
                            ON CONFLICT (time, product_id, store_id) DO UPDATE SET
                                price_azn = EXCLUDED.price_azn,
                                in_stock = EXCLUDED.in_stock
                        """),
                        {
                            "days": days_ago,
                            "product_id": product_id,
                            "store_id": store_id,
                            "price": round(float(price_azn) * multiplier, 2),
                            "in_stock": in_stock,
                        },
                    )

        await session.commit()
        print(
            f"Successfully seeded {seeded_products} products and {seeded_prices} price offers."
        )

    try:
        await invalidate_cache("products:*")
        await invalidate_cache("filters:*")
    except Exception as exc:
        logger.debug("Cache invalidation error: %s", exc)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())

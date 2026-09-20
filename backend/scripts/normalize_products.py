"""
One-time script to populate model_family and attributes (storage_gb, color)
for all products in the database.

Usage:
  docker compose exec backend python -m scripts.normalize_products
"""

import asyncio
import json
import os

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from shared.normalizer import normalize_name


async def run():
    database_url = os.environ.get("DATABASE_URL")
    if database_url:
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    else:
        pg_host = os.environ.get("POSTGRES_HOST", "localhost")
        pg_port = os.environ.get("POSTGRES_PORT", "5432")
        pg_user = os.environ.get("POSTGRES_USER", "qiymetleri")
        pg_pass = os.environ.get("POSTGRES_PASSWORD")
        if not pg_pass:
            raise RuntimeError(
                "Set DATABASE_URL or POSTGRES_PASSWORD env var before running this script."
            )
        pg_db = os.environ.get("POSTGRES_DB", "qiymetleri")
        database_url = (
            f"postgresql+asyncpg://{pg_user}:{pg_pass}@{pg_host}:{pg_port}/{pg_db}"
        )

    engine = create_async_engine(database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        result = await session.execute(
            text("SELECT id, name, brand, category FROM products ORDER BY name")
        )
        rows = result.fetchall()
        print(f"Found {len(rows)} products to normalize")

        # First pass: normalize all products
        updated = 0
        all_parsed = []  # (pid, parsed_dict) for second pass
        for row in rows:
            pid, name, brand, category = row
            parsed = normalize_name(name)

            attrs = {}
            if parsed["storage_gb"]:
                attrs["storage_gb"] = parsed["storage_gb"]
            if parsed["ram_gb"]:
                attrs["ram_gb"] = parsed["ram_gb"]
            if parsed["color"]:
                attrs["color"] = parsed["color"]
            if parsed["sku"]:
                attrs["sku"] = parsed["sku"]

            model_family = parsed["model_family"]
            all_parsed.append((str(pid), model_family, attrs))

            if model_family or attrs:
                await session.execute(
                    text("""
                        UPDATE products
                        SET model_family = :model_family,
                            attributes = CAST(:attrs AS jsonb)
                        WHERE id = :pid
                    """),
                    {
                        "model_family": model_family,
                        "attrs": json.dumps(attrs),
                        "pid": str(pid),
                    },
                )
                updated += 1

        await session.commit()
        print(f"Updated {updated} products")

        # Second pass: propagate storage/color from SKU-matched siblings
        # Build lookup: SKU → {storage_gb, color} from products that have full attributes
        sku_attrs: dict[str, dict] = {}
        for pid, family, attrs in all_parsed:
            sku = attrs.get("sku")
            if sku and attrs.get("storage_gb"):
                sku_attrs[sku] = {
                    "storage_gb": attrs.get("storage_gb"),
                    "color": attrs.get("color"),
                }

        # Fill missing attributes from SKU lookup
        propagated = 0
        for pid, family, attrs in all_parsed:
            sku = attrs.get("sku")
            if sku and sku in sku_attrs and not attrs.get("storage_gb"):
                donor = sku_attrs[sku]
                attrs["storage_gb"] = donor["storage_gb"]
                if not attrs.get("color") and donor.get("color"):
                    attrs["color"] = donor["color"]
                await session.execute(
                    text("""
                        UPDATE products
                        SET attributes = CAST(:attrs AS jsonb)
                        WHERE id = :pid
                    """),
                    {"attrs": json.dumps(attrs), "pid": pid},
                )
                propagated += 1

        await session.commit()
        if propagated:
            print(f"Propagated attributes to {propagated} products via SKU matching")

        result = await session.execute(text("""
                SELECT model_family, COUNT(*) as cnt
                FROM products
                WHERE model_family IS NOT NULL
                GROUP BY model_family
                HAVING COUNT(*) > 1
                ORDER BY cnt DESC
                LIMIT 20
            """))
        print("\nTop families with multiple variants:")
        for row in result.fetchall():
            print(f"  {row[0]}: {row[1]} variants")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run())

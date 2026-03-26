"""
One-time script to populate model_family and attributes (storage_gb, color)
for all products in the database.

Usage:
  docker compose exec backend python -m scripts.normalize_products
"""

import asyncio
import json
import os
import re

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

# ─── Color dictionary ───────────────────────────────────────────────
KNOWN_COLORS = [
    "midnight", "starlight", "sky blue", "space gray", "space grey",
    "natural titanium", "black titanium", "white titanium", "desert titanium",
    "cobalt violet", "icyblue", "icy blue", "silver shadow",
    "phantom black", "ocean cyan", "mocha brown", "navy peony blue",
    "navy blue", "dark blue", "light blue", "velvet black",
    "dawning orange", "forest owl", "jade black", "sakura pink",
    "verona green", "mica silver", "jet black", "jetblack",
    "titanium gray", "titanium grey", "light gold",
    "black", "white", "blue", "green", "pink", "yellow", "red",
    "gold", "silver", "gray", "grey", "orange",
    "purple", "brown", "beige", "cream", "coral", "teal",
    "mint", "lavender", "bronze", "graphite", "titanium",
]
KNOWN_COLORS.sort(key=len, reverse=True)

COLOR_PATTERN = re.compile(
    r"\b(" + "|".join(re.escape(c) for c in KNOWN_COLORS) + r")\b",
    re.IGNORECASE,
)

# ─── Storage patterns ───────────────────────────────────────────────
STORAGE_PATTERN = re.compile(
    r"(?<!\d[/x])(\d{1,4})\s*([GT])B\b",
    re.IGNORECASE,
)

RAM_STORAGE_PATTERN = re.compile(
    r"(\d{1,3})\s*(?:GB)?\s*[/]\s*(\d{1,4})\s*([GT])B\b",
    re.IGNORECASE,
)


def normalize_name(name: str) -> dict:
    """Extract model_family, storage_gb, ram_gb, color from product name."""
    result = {
        "model_family": None,
        "storage_gb": None,
        "ram_gb": None,
        "color": None,
    }

    cleaned = name.strip()

    for prefix in [
        "Smartfon ", "Notbuk ", "Noutbuk ",
        "Simsiz qulaqlıq ", "Qulaqlıq ", "Qulaqlıqlar ",
    ]:
        if cleaned.startswith(prefix):
            cleaned = cleaned[len(prefix):]
            break

    # Extract color
    color_matches = list(COLOR_PATTERN.finditer(cleaned))
    if color_matches:
        result["color"] = color_matches[-1].group(1).strip().title()

    # Extract RAM/Storage combined
    ram_storage_match = RAM_STORAGE_PATTERN.search(cleaned)
    if ram_storage_match:
        ram = int(ram_storage_match.group(1))
        storage = int(ram_storage_match.group(2))
        unit = ram_storage_match.group(3).upper()
        if unit == "T":
            storage *= 1024
        if ram <= 64:
            result["ram_gb"] = ram
        result["storage_gb"] = storage
    else:
        storage_matches = list(STORAGE_PATTERN.finditer(cleaned))
        if storage_matches:
            for m in storage_matches:
                val = int(m.group(1))
                unit = m.group(2).upper()
                if unit == "T":
                    val *= 1024
                if val >= 32:
                    result["storage_gb"] = val
                    break

    # Build model family
    family = cleaned
    family = RAM_STORAGE_PATTERN.sub("", family)
    family = STORAGE_PATTERN.sub("", family)

    # Remove colors from family string
    family = COLOR_PATTERN.sub("", family)

    family = re.sub(r"\([^)]*\)", "", family)
    family = re.sub(r"[\s,\-/]+$", "", family)
    family = re.sub(r"\s{2,}", " ", family)
    family = family.strip()
    family = re.sub(r"\b\d*\s*[GT]B\b", "", family, flags=re.IGNORECASE).strip()
    family = re.sub(r"\s{2,}", " ", family).strip()
    family = re.sub(r"[\s,\-/]+$", "", family).strip()

    if family:
        result["model_family"] = family

    return result


async def run():
    database_url = os.environ.get(
        "DATABASE_URL",
        "postgresql+asyncpg://qiymetleri:qiymetleri_secret@localhost:5432/qiymetleri",
    )
    if "asyncpg" not in database_url:
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://")

    engine = create_async_engine(database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        result = await session.execute(
            text("SELECT id, name, brand, category FROM products ORDER BY name")
        )
        rows = result.fetchall()
        print(f"Found {len(rows)} products to normalize")

        updated = 0
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

            model_family = parsed["model_family"]

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

        result = await session.execute(
            text("""
                SELECT model_family, COUNT(*) as cnt
                FROM products
                WHERE model_family IS NOT NULL
                GROUP BY model_family
                HAVING COUNT(*) > 1
                ORDER BY cnt DESC
                LIMIT 20
            """)
        )
        print("\nTop families with multiple variants:")
        for row in result.fetchall():
            print(f"  {row[0]}: {row[1]} variants")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run())

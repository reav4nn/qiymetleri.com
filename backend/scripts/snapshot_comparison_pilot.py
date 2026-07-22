"""Create the frozen smartphone pilot list for comparison Phase 0.

The command is read-only unless ``--output`` is provided. Run it after the
current retailer catalogue has been normalized:

    python -m scripts.snapshot_comparison_pilot
    python -m scripts.snapshot_comparison_pilot --output pilot-smartphones.json
"""

from __future__ import annotations

import argparse
import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal, engine

PILOT_CATEGORY = "smartphones"
PILOT_LIMIT = 50
SELECTION_RULE = (
    "store count desc, variant count desc, price availability, "
    "lowest price desc, brand asc, model family asc"
)

PILOT_QUERY = text("""
    WITH candidates AS (
        SELECT
            LOWER(TRIM(p.brand)) AS brand_key,
            LOWER(TRIM(p.model_family)) AS family_key,
            MIN(TRIM(p.brand)) AS brand,
            MIN(TRIM(p.model_family)) AS model_family,
            MIN(p.id::text) AS representative_product_id,
            COUNT(DISTINCT p.id) AS variant_count,
            COUNT(DISTINCT cp.store_id) AS store_count,
            MIN(cp.price_azn) FILTER (
                WHERE cp.in_stock = TRUE
            ) AS lowest_price
        FROM products p
        LEFT JOIN current_prices cp ON cp.product_id = p.id
        WHERE p.category = :category
          AND p.brand IS NOT NULL
          AND TRIM(p.brand) <> ''
          AND p.model_family IS NOT NULL
          AND TRIM(p.model_family) <> ''
        GROUP BY
            LOWER(TRIM(p.brand)),
            LOWER(TRIM(p.model_family))
    )
    SELECT * FROM candidates
    ORDER BY
        store_count DESC,
        variant_count DESC,
        (lowest_price IS NULL) ASC,
        lowest_price DESC NULLS LAST,
        brand_key ASC,
        family_key ASC
    LIMIT :limit
""")


def build_snapshot(
    rows: list[dict[str, Any]], generated_at: datetime
) -> dict[str, Any]:
    """Build the stable JSON contract emitted by the pilot selector."""
    models = []
    for rank, row in enumerate(rows, start=1):
        lowest_price = row.get("lowest_price")
        models.append(
            {
                "rank": rank,
                "pilot_key": (
                    f"{row['brand_key']}:{row.get('family_key', str(row['model_family']).strip().lower())}"
                ),
                "brand": row["brand"],
                "model_family": row["model_family"],
                "representative_product_id": row["representative_product_id"],
                "variant_count": int(row["variant_count"]),
                "store_count": int(row["store_count"]),
                "lowest_price_azn": (
                    float(lowest_price) if lowest_price is not None else None
                ),
            }
        )

    return {
        "contract_version": 1,
        "category_id": PILOT_CATEGORY,
        "limit": PILOT_LIMIT,
        "selection_rule": SELECTION_RULE,
        "generated_at": generated_at.astimezone(timezone.utc).isoformat(),
        "models": models,
    }


async def select_pilot_candidates(
    session: AsyncSession, limit: int = PILOT_LIMIT
) -> list[dict[str, Any]]:
    if not 1 <= limit <= PILOT_LIMIT:
        raise ValueError(f"limit must be between 1 and {PILOT_LIMIT}")
    result = await session.execute(
        PILOT_QUERY,
        {"category": PILOT_CATEGORY, "limit": limit},
    )
    return [dict(row) for row in result.mappings().all()]


async def run(output: Path | None = None) -> dict[str, Any]:
    async with AsyncSessionLocal() as session:
        rows = await select_pilot_candidates(session)
    snapshot = build_snapshot(rows, datetime.now(timezone.utc))
    serialized = json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n"
    if output is None:
        print(serialized, end="")
    else:
        output.write_text(serialized, encoding="utf-8")
        print(f"Wrote {len(rows)} pilot models to {output}")
    await engine.dispose()
    return snapshot


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    asyncio.run(run(args.output))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

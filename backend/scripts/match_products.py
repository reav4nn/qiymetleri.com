"""
Cross-store fuzzy product matching script.

Finds products with similar model_family across different stores and
merges them (or flags for review).

Usage:
  docker compose exec backend python -m scripts.match_products
  docker compose exec backend python -m scripts.match_products --dry-run
  docker compose exec backend python -m scripts.match_products --threshold 0.8
"""

import asyncio
import os
import re
import sys

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

AUTO_MERGE_THRESHOLD = 0.85
REVIEW_THRESHOLD = 0.60

# Regex to extract series/generation number from model families.
# Prevents merging "Series 10" with "Series 11", "iPhone 16" with "iPhone 17", etc.
_VERSION_PATTERNS = [
    re.compile(r"Series\s+(\d+)", re.IGNORECASE),
    re.compile(r"iPhone\s+(\d+)", re.IGNORECASE),
    re.compile(r"iPad\s+(?:Air|Pro|mini)?\s*(\d+)", re.IGNORECASE),
    re.compile(r"Galaxy\s+S(\d+)", re.IGNORECASE),
    re.compile(r"Galaxy\s+A(\d+)", re.IGNORECASE),
    re.compile(r"Pixel\s+(\d+)", re.IGNORECASE),
    re.compile(r"MacBook\s+(?:Air|Pro)\s+M(\d+)", re.IGNORECASE),
    re.compile(r"Ultra\s+(\d+)", re.IGNORECASE),
    re.compile(r"SE\s+(\d+)", re.IGNORECASE),
    re.compile(r"Redmi\s+(\d+)", re.IGNORECASE),
    re.compile(r"Watch\s+(\d+)", re.IGNORECASE),
    re.compile(r"AirPods\s+(\d+)", re.IGNORECASE),
    re.compile(r"AirPods\s+Pro\s+(\d+)", re.IGNORECASE),
]


def _has_version_conflict(a: str, b: str) -> bool:
    """Return True if a and b differ only by version/series number.

    E.g. 'Apple Watch Series 10 46mm' vs 'Apple Watch Series 11 46mm' → True
         'iPhone 16 Pro' vs 'iPhone 17 Pro' → True
         'iPhone 16 128GB' vs 'iPhone 16 256GB' → False (same version)
    """
    for pat in _VERSION_PATTERNS:
        ma = pat.search(a)
        mb = pat.search(b)
        if ma and mb and ma.group(1) != mb.group(1):
            return True
    return False


def _pick_canonical_family(a: str, b: str) -> str:
    """Pick the better canonical model_family name.

    Prefers the shorter, cleaner name (without extra specs/model numbers).
    If similar length, prefer one without extra punctuation.
    """
    # Strip screen sizes like "14.2" → "14", "16.2" → "16", "13.6" → "13"
    import re

    def _complexity(s: str) -> int:
        """Higher = more verbose / less clean."""
        score = len(s)
        score += s.count("/") * 5
        score += s.count(",") * 3
        score += s.count("-") * 2
        score += len(re.findall(r"\d+\.\d+", s)) * 4  # decimal numbers
        return score

    ca, cb = _complexity(a), _complexity(b)
    if ca != cb:
        return a if ca < cb else b
    return a if len(a) <= len(b) else b


async def run(dry_run: bool = False, threshold: float = AUTO_MERGE_THRESHOLD):
    pg_host = os.environ.get("POSTGRES_HOST", "localhost")
    pg_port = os.environ.get("POSTGRES_PORT", "5432")
    pg_user = os.environ.get("POSTGRES_USER", "qiymetleri")
    pg_pass = os.environ.get("POSTGRES_PASSWORD", "qiymetleri_secret")
    pg_db = os.environ.get("POSTGRES_DB", "qiymetleri")
    database_url = (
        f"postgresql+asyncpg://{pg_user}:{pg_pass}@{pg_host}:{pg_port}/{pg_db}"
    )

    engine = create_async_engine(database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Find all model_family pairs with similarity > REVIEW_THRESHOLD
        # that exist in different stores (cross-store matching)
        result = await session.execute(
            text("""
                WITH family_stores AS (
                    SELECT DISTINCT p.model_family, p.brand,
                           string_agg(DISTINCT cp.store_id, ',' ORDER BY cp.store_id) AS stores
                    FROM products p
                    JOIN current_prices cp ON cp.product_id = p.id
                    WHERE p.model_family IS NOT NULL
                    GROUP BY p.model_family, p.brand
                )
                SELECT a.model_family AS family_a,
                       b.model_family AS family_b,
                       a.brand,
                       similarity(a.model_family, b.model_family) AS sim,
                       a.stores AS stores_a,
                       b.stores AS stores_b
                FROM family_stores a
                CROSS JOIN family_stores b
                WHERE a.model_family < b.model_family
                  AND a.brand = b.brand
                  AND similarity(a.model_family, b.model_family) > :threshold
                  AND a.stores != b.stores
                ORDER BY sim DESC
            """),
            {"threshold": REVIEW_THRESHOLD},
        )
        matches = result.fetchall()
        print(f"Found {len(matches)} potential cross-store matches\n")

        auto_merged = 0
        flagged_review = 0
        merge_map: dict[str, str] = {}  # old_family → canonical_family

        for row in matches:
            family_a, family_b, brand, sim, stores_a, stores_b = row
            sim = float(sim)

            # Skip if either family was already merged in this run
            if family_a in merge_map or family_b in merge_map:
                # Follow merge chain
                actual_a = merge_map.get(family_a, family_a)
                actual_b = merge_map.get(family_b, family_b)
                if actual_a == actual_b:
                    continue

            # Never merge different product versions/series
            if _has_version_conflict(family_a, family_b):
                continue

            canonical = _pick_canonical_family(family_a, family_b)
            other = family_b if canonical == family_a else family_a

            if sim >= threshold:
                print(f"  AUTO-MERGE (sim={sim:.3f}): [{brand}]")
                print(f"    '{other}' ({stores_b if canonical == family_a else stores_a})")
                print(f"    → '{canonical}' ({stores_a if canonical == family_a else stores_b})")

                if not dry_run:
                    await session.execute(
                        text("""
                            UPDATE products
                            SET model_family = :canonical
                            WHERE model_family = :other AND brand = :brand
                        """),
                        {"canonical": canonical, "other": other, "brand": brand},
                    )

                    await session.execute(
                        text("""
                            INSERT INTO product_matches (family_a, family_b, brand, similarity, status, merged_family)
                            VALUES (:fa, :fb, :brand, :sim, 'accepted', :merged)
                            ON CONFLICT (family_a, family_b) DO UPDATE
                            SET status = 'accepted', merged_family = :merged, reviewed_at = NOW()
                        """),
                        {
                            "fa": family_a,
                            "fb": family_b,
                            "brand": brand,
                            "sim": sim,
                            "merged": canonical,
                        },
                    )

                merge_map[other] = canonical
                auto_merged += 1

            elif sim >= REVIEW_THRESHOLD:
                print(f"  REVIEW (sim={sim:.3f}): [{brand}]")
                print(f"    '{family_a}' ({stores_a})")
                print(f"    '{family_b}' ({stores_b})")

                if not dry_run:
                    await session.execute(
                        text("""
                            INSERT INTO product_matches (family_a, family_b, brand, similarity, status)
                            VALUES (:fa, :fb, :brand, :sim, 'pending')
                            ON CONFLICT (family_a, family_b) DO NOTHING
                        """),
                        {
                            "fa": family_a,
                            "fb": family_b,
                            "brand": brand,
                            "sim": sim,
                        },
                    )

                flagged_review += 1

        if not dry_run:
            await session.commit()

        print("\nSummary:")
        print(f"  Auto-merged: {auto_merged}")
        print(f"  Flagged for review: {flagged_review}")
        if dry_run:
            print("  (DRY RUN — no changes made)")

    await engine.dispose()


if __name__ == "__main__":
    dry = "--dry-run" in sys.argv
    thresh = AUTO_MERGE_THRESHOLD
    for i, arg in enumerate(sys.argv):
        if arg == "--threshold" and i + 1 < len(sys.argv):
            thresh = float(sys.argv[i + 1])

    asyncio.run(run(dry_run=dry, threshold=thresh))

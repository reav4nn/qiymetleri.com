import re

from sqlalchemy import text as sa_text
from sqlalchemy.ext.asyncio import AsyncSession


REVIEW_THRESHOLD = 0.60

_VERSION_PATTERNS = (
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
    re.compile(r"AirPods\s+(?:Pro\s+)?(\d+)", re.IGNORECASE),
)


def has_version_conflict(family_a: str, family_b: str) -> bool:
    """Prevent suggestions between different product generations."""
    for pattern in _VERSION_PATTERNS:
        version_a = pattern.search(family_a)
        version_b = pattern.search(family_b)
        if version_a and version_b and version_a.group(1) != version_b.group(1):
            return True
    return False


async def generate_match_suggestions(
    db: AsyncSession, threshold: float = REVIEW_THRESHOLD
) -> dict:
    """Find new cross-store product-family matches for manual review."""
    result = await db.execute(
        sa_text("""
            WITH family_stores AS (
                SELECT p.model_family, LOWER(p.brand) AS brand, p.category,
                       array_agg(DISTINCT cp.store_id ORDER BY cp.store_id) AS stores
                FROM products p
                JOIN current_prices cp ON cp.product_id = p.id
                WHERE p.model_family IS NOT NULL
                  AND p.model_family <> ''
                  AND p.brand IS NOT NULL
                GROUP BY p.model_family, LOWER(p.brand), p.category
            )
            SELECT a.model_family AS family_a,
                   b.model_family AS family_b,
                   a.brand,
                   similarity(a.model_family, b.model_family) AS similarity
            FROM family_stores a
            JOIN family_stores b
              ON a.brand = b.brand
             AND a.category IS NOT DISTINCT FROM b.category
             AND a.model_family < b.model_family
             AND a.stores <> b.stores
            WHERE similarity(a.model_family, b.model_family) >= :threshold
            ORDER BY similarity DESC
        """),
        {"threshold": threshold},
    )
    candidates = result.all()

    created = 0
    skipped_version_conflicts = 0
    for row in candidates:
        family_a, family_b, brand, similarity = row
        if has_version_conflict(family_a, family_b):
            skipped_version_conflicts += 1
            continue

        inserted = await db.execute(
            sa_text("""
                INSERT INTO product_matches
                    (family_a, family_b, brand, similarity, status)
                VALUES (:family_a, :family_b, :brand, :similarity, 'pending')
                ON CONFLICT (family_a, family_b) DO NOTHING
                RETURNING id
            """),
            {
                "family_a": family_a,
                "family_b": family_b,
                "brand": brand,
                "similarity": similarity,
            },
        )
        if inserted.first():
            created += 1

    if created:
        await db.commit()

    return {
        "candidates": len(candidates),
        "created": created,
        "skipped_version_conflicts": skipped_version_conflicts,
    }

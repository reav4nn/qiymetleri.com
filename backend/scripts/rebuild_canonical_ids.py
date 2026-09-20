"""
Rebuild canonical_id for all products using normalized attributes.

This improves cross-store matching by using model_family + storage + color
instead of the naive brand + title slug.

Usage:
  docker compose exec backend python -m scripts.rebuild_canonical_ids
  docker compose exec backend python -m scripts.rebuild_canonical_ids --dry-run
"""

import asyncio
import os
import re
import sys

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from shared.normalizer import normalize_name


def build_canonical_id(brand: str, name: str) -> str:
    """Build a canonical ID using normalized attributes."""
    brand = (brand or "unknown").lower().strip()
    parsed = normalize_name(name)
    family = parsed.get("model_family")

    if family:
        parts = [brand, family.lower()]
        if parsed.get("storage_gb"):
            parts.append(f"{parsed['storage_gb']}gb")
        if parsed.get("color"):
            parts.append(parsed["color"].lower())
        slug = re.sub(r"[^a-z0-9]+", "_", "_".join(parts)).strip("_")
        return slug[:255]

    slug = re.sub(r"[^a-z0-9]+", "_", f"{brand}_{name}".lower()).strip("_")
    return slug[:255]


async def run(dry_run: bool = False):
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
            text("SELECT id, canonical_id, name, brand FROM products ORDER BY name")
        )
        rows = result.fetchall()
        print(f"Found {len(rows)} products to process")

        updated = 0
        conflicts = 0
        new_ids: dict[str, list[str]] = {}  # new_canonical_id → [old_ids]

        for row in rows:
            pid, old_canonical, name, brand = row
            new_canonical = build_canonical_id(brand, name)

            if new_canonical == old_canonical:
                continue

            # Track for conflict detection
            if new_canonical not in new_ids:
                new_ids[new_canonical] = []
            new_ids[new_canonical].append(str(pid))

        # Build set of all existing canonical IDs
        existing_cids = {r[1] for r in rows}

        # Report conflicts (multiple products mapping to same new canonical ID)
        merge_candidates = {k: v for k, v in new_ids.items() if len(v) > 1}
        if merge_candidates:
            print(
                f"\nFound {len(merge_candidates)} merge candidates (same new canonical_id):"
            )
            for cid, pids in list(merge_candidates.items())[:10]:
                print(f"  {cid}: {len(pids)} products")

        # Only update when new ID doesn't collide with existing products
        changes = {}
        skipped_existing = 0
        for k, v in new_ids.items():
            if len(v) == 1:
                if k in existing_cids:
                    skipped_existing += 1
                else:
                    changes[k] = v

        print(f"\nWould update {len(changes)} products (no conflicts)")
        print(f"Would merge {len(merge_candidates)} groups")
        print(f"Skipped {skipped_existing} (new ID already exists)")

        if not dry_run:
            for new_cid, pids in changes.items():
                pid = pids[0]
                try:
                    await session.execute(
                        text("""
                            UPDATE products SET canonical_id = :new_cid
                            WHERE id = CAST(:pid AS uuid)
                        """),
                        {"new_cid": new_cid, "pid": pid},
                    )
                    updated += 1
                except Exception:
                    await session.rollback()
                    conflicts += 1

            await session.commit()
            print(f"\nUpdated {updated} products, {conflicts} conflicts skipped")
        else:
            print("\n(DRY RUN — no changes made)")

    await engine.dispose()


if __name__ == "__main__":
    dry = "--dry-run" in sys.argv
    asyncio.run(run(dry_run=dry))

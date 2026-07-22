from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from shared.model_identity import model_slug


@dataclass(frozen=True)
class MappingCandidate:
    product_id: uuid.UUID
    category: str | None
    brand: str | None
    model_family: str | None
    product_name: str

    @property
    def is_exact(self) -> bool:
        return all(
            value is not None and value.strip()
            for value in (self.category, self.brand, self.model_family)
        )

    @property
    def normalized_group(self) -> tuple[str, str, str] | None:
        if not self.is_exact:
            return None
        return (
            self.category.strip(),  # type: ignore[union-attr]
            self.brand.strip(),  # type: ignore[union-attr]
            self.model_family.strip(),  # type: ignore[union-attr]
        )


def provisional_reason(candidate: MappingCandidate) -> str:
    missing = []
    if not candidate.brand or not candidate.brand.strip():
        missing.append("brand")
    if not candidate.model_family or not candidate.model_family.strip():
        missing.append("model_family")
    if not candidate.category or not candidate.category.strip():
        missing.append("category")
    return "missing_" + "_and_".join(missing or ["trusted_mapping"])


async def catalogue_snapshot(db: AsyncSession) -> dict[str, Any]:
    row = (await db.execute(text("""
                SELECT jsonb_build_object(
                    'products', (SELECT count(*) FROM products),
                    'current_prices', (SELECT count(*) FROM current_prices),
                    'current_prices_checksum', (
                        SELECT coalesce(sum(hashtextextended(concat_ws('|', product_id::text,
                            store_id, price_azn::text, in_stock::text), 0))::text, '0')
                        FROM current_prices
                    ),
                    'price_history', (SELECT count(*) FROM price_history),
                    'price_history_checksum', (
                        SELECT coalesce(sum(hashtextextended(concat_ws('|', time::text,
                            product_id::text, store_id, price_azn::text,
                            coalesce(in_stock::text, '')), 0))::text, '0')
                        FROM price_history
                    ),
                    'lowest_price_view_checksum', (
                        SELECT coalesce(sum(hashtextextended(concat_ws('|', id::text,
                            canonical_id, coalesce(lowest_price::text, ''), store_count::text,
                            coalesce(cheapest_store, '')), 0))::text, '0')
                        FROM v_product_lowest_price
                    )
                )
            """))).scalar_one()
    return dict(row)


async def dry_run_report(db: AsyncSession) -> dict[str, Any]:
    counts = (await db.execute(text("""
                SELECT
                    count(*) FILTER (WHERE model_id IS NULL) AS unmapped,
                    count(*) FILTER (
                        WHERE model_id IS NULL
                          AND length(btrim(coalesce(category, ''))) > 0
                          AND length(btrim(coalesce(brand, ''))) > 0
                          AND length(btrim(coalesce(model_family, ''))) > 0
                    ) AS exact_products,
                    count(*) FILTER (
                        WHERE model_id IS NULL
                          AND (length(btrim(coalesce(category, ''))) = 0
                            OR length(btrim(coalesce(brand, ''))) = 0
                            OR length(btrim(coalesce(model_family, ''))) = 0)
                    ) AS provisional_products,
                    count(DISTINCT (
                        lower(btrim(category)), lower(btrim(brand)), lower(btrim(model_family))
                    )) FILTER (
                        WHERE model_id IS NULL
                          AND length(btrim(coalesce(category, ''))) > 0
                          AND length(btrim(coalesce(brand, ''))) > 0
                          AND length(btrim(coalesce(model_family, ''))) > 0
                    ) AS exact_groups
                FROM products
            """))).one()
    return {
        "dry_run": True,
        "unmapped": counts.unmapped,
        "exact_products": counts.exact_products,
        "exact_groups": counts.exact_groups,
        "provisional_products": counts.provisional_products,
        "catalogue_snapshot": await catalogue_snapshot(db),
    }


async def _ensure_category(db: AsyncSession, category: str | None) -> str:
    category_id = (category or "").strip().lower() or "uncategorized"
    label = (category or "").strip() or "Uncategorized"
    await db.execute(
        text("""
            INSERT INTO categories (id, labels, status)
            VALUES (
                :id,
                jsonb_build_object('az', CAST(:label AS text), 'ru', CAST(:label AS text)),
                'draft'
            )
            ON CONFLICT (id) DO NOTHING
        """),
        {"id": category_id, "label": label},
    )
    return category_id


async def _unique_slug(
    db: AsyncSession, brand: str, name: str, model_id: uuid.UUID
) -> str:
    candidate = model_slug(brand, name)
    await db.execute(
        text(
            "SELECT pg_advisory_xact_lock(hashtextextended('slug:' || lower(CAST(:slug AS text)), 0))"
        ),
        {"slug": candidate},
    )
    # UUID suffixes make collisions extremely unlikely, but both current slugs
    # and historical aliases are authoritative namespaces.
    collision = await db.scalar(
        text("""
            SELECT EXISTS (
                SELECT 1 FROM product_models WHERE lower(slug) = lower(:slug)
                UNION ALL
                SELECT 1 FROM product_model_slug_aliases WHERE lower(alias) = lower(:slug)
            )
        """),
        {"slug": candidate},
    )
    if not collision:
        return candidate
    suffixed = f"{candidate[:311].rstrip('-')}-{str(model_id)[:8]}"
    second_collision = await db.scalar(
        text("""
            SELECT EXISTS (
                SELECT 1 FROM product_models WHERE lower(slug) = lower(:slug)
                UNION ALL
                SELECT 1 FROM product_model_slug_aliases WHERE lower(alias) = lower(:slug)
            )
        """),
        {"slug": suffixed},
    )
    if second_collision:
        return f"{candidate[:302].rstrip('-')}-{model_id.hex[:17]}"
    return suffixed


async def _create_model(
    db: AsyncSession,
    *,
    category_id: str,
    brand: str,
    name: str,
    status: str,
    reason: str,
) -> uuid.UUID:
    model_id = uuid.uuid4()
    slug = await _unique_slug(db, brand, name, model_id)
    await db.execute(
        text("""
            INSERT INTO product_models (id, category_id, brand, name, slug, status)
            VALUES (:id, :category, :brand, :name, :slug, :status)
        """),
        {
            "id": model_id,
            "category": category_id,
            "brand": brand,
            "name": name,
            "slug": slug,
            "status": status,
        },
    )
    await db.execute(
        text("""
            INSERT INTO spec_audit_events
                (actor, action, entity_type, entity_id, after, reason)
            VALUES ('system:model-backfill', 'create', 'product_model', :entity_id,
                    CAST(:after AS jsonb), :reason)
        """),
        {
            "entity_id": str(model_id),
            "after": json.dumps(
                {
                    "category_id": category_id,
                    "brand": brand,
                    "name": name,
                    "slug": slug,
                    "status": status,
                }
            ),
            "reason": reason,
        },
    )
    return model_id


async def _find_exact_model(
    db: AsyncSession, group: tuple[str, str, str]
) -> uuid.UUID | None:
    category, brand, family = group
    return await db.scalar(
        text("""
            SELECT pm.id
            FROM product_models pm
            JOIN products p ON p.model_id = pm.id
            WHERE pm.category_id = lower(btrim(CAST(:category AS text)))
              AND lower(btrim(p.category)) = lower(btrim(CAST(:category AS text)))
              AND lower(btrim(p.brand)) = lower(btrim(CAST(:brand AS text)))
              AND lower(btrim(p.model_family)) = lower(btrim(CAST(:family AS text)))
            ORDER BY (pm.status = 'verified') DESC, pm.created_at, pm.id
            LIMIT 1
        """),
        {"category": category, "brand": brand, "family": family},
    )


async def _map_exact_group(
    db: AsyncSession, candidate: MappingCandidate
) -> tuple[uuid.UUID, list[uuid.UUID]]:
    group = candidate.normalized_group
    assert group is not None
    category, brand_key, family_key = group
    await db.execute(
        text(
            "SELECT pg_advisory_xact_lock(hashtextextended(lower(CAST(:key AS text)), 0))"
        ),
        {"key": "|".join(group)},
    )
    model_id = await _find_exact_model(db, group)
    created = model_id is None
    if model_id is None:
        category_id = await _ensure_category(db, category)
        model_id = await _create_model(
            db,
            category_id=category_id,
            brand=candidate.brand.strip(),  # type: ignore[union-attr]
            name=candidate.model_family.strip(),  # type: ignore[union-attr]
            status="verified",
            reason="exact legacy category/brand/model_family backfill group",
        )
    mapped = (
        (
            await db.execute(
                text("""
                UPDATE products
                SET model_id = :model_id
                WHERE model_id IS NULL
                  AND lower(btrim(category)) = lower(btrim(CAST(:category AS text)))
                  AND lower(btrim(brand)) = lower(btrim(CAST(:brand AS text)))
                  AND lower(btrim(model_family)) = lower(btrim(CAST(:family AS text)))
                RETURNING id
            """),
                {
                    "model_id": model_id,
                    "category": category,
                    "brand": brand_key,
                    "family": family_key,
                },
            )
        )
        .scalars()
        .all()
    )
    if not mapped and created:
        await db.execute(
            text("DELETE FROM product_models WHERE id = :id"), {"id": model_id}
        )
        current_model = await db.scalar(
            text("SELECT model_id FROM products WHERE id = :id"),
            {"id": candidate.product_id},
        )
        if current_model is None:
            raise RuntimeError(
                f"exact mapping made no progress for product {candidate.product_id}"
            )
        model_id = current_model
    return model_id, list(mapped)


async def _map_provisional(
    db: AsyncSession, candidate: MappingCandidate
) -> tuple[uuid.UUID, list[uuid.UUID]]:
    current_model = await db.scalar(
        text("SELECT model_id FROM products WHERE id = :id FOR UPDATE"),
        {"id": candidate.product_id},
    )
    if current_model is not None:
        return current_model, []
    category_id = await _ensure_category(db, candidate.category)
    brand = (candidate.brand or "Unknown").strip() or "Unknown"
    name = (candidate.model_family or candidate.product_name).strip()
    reason = provisional_reason(candidate)
    model_id = await _create_model(
        db,
        category_id=category_id,
        brand=brand,
        name=name,
        status="provisional",
        reason=f"safe singleton backfill: {reason}",
    )
    mapped = (
        (
            await db.execute(
                text("""
                UPDATE products SET model_id = :model_id
                WHERE id = :product_id AND model_id IS NULL
                RETURNING id
            """),
                {"model_id": model_id, "product_id": candidate.product_id},
            )
        )
        .scalars()
        .all()
    )
    if mapped:
        await db.execute(
            text("""
                INSERT INTO model_mapping_reviews
                    (product_id, current_model_id, confidence, reason)
                VALUES (:product_id, :model_id, 0, :reason)
                ON CONFLICT (product_id) WHERE status = 'pending' DO NOTHING
            """),
            {
                "product_id": candidate.product_id,
                "model_id": model_id,
                "reason": reason,
            },
        )
    return model_id, list(mapped)


async def _select_default_variant(db: AsyncSession, model_id: uuid.UUID) -> None:
    await db.execute(
        text(
            "UPDATE products SET is_default_variant = false WHERE model_id = :model_id"
        ),
        {"model_id": model_id},
    )
    await db.execute(
        text(r"""
            WITH ranked AS (
                SELECT p.id
                FROM products p
                WHERE p.model_id = :model_id
                ORDER BY
                    EXISTS (
                        SELECT 1 FROM current_prices cp
                        WHERE cp.product_id = p.id AND cp.in_stock
                    ) DESC,
                    CASE WHEN p.attributes->>'storage_gb' ~ '^[0-9]+([.][0-9]+)?$'
                         THEN (p.attributes->>'storage_gb')::numeric END ASC NULLS LAST,
                    CASE WHEN p.attributes->>'ram_gb' ~ '^[0-9]+([.][0-9]+)?$'
                         THEN (p.attributes->>'ram_gb')::numeric END ASC NULLS LAST,
                    p.canonical_id ASC
                LIMIT 1
            )
            UPDATE products SET is_default_variant = true
            WHERE id = (SELECT id FROM ranked)
        """),
        {"model_id": model_id},
    )


async def reconciliation_report(
    db: AsyncSession, baseline: dict[str, Any]
) -> dict[str, Any]:
    current = await catalogue_snapshot(db)
    row = (await db.execute(text("""
                SELECT
                    count(*) FILTER (WHERE p.model_id IS NULL) AS unmapped,
                    count(*) FILTER (
                        WHERE pm.status = 'verified'
                          AND lower(btrim(p.category)) <> pm.category_id
                    ) AS cross_category_verified,
                    count(*) FILTER (
                        WHERE pm.status = 'verified'
                          AND lower(btrim(p.brand)) <> lower(btrim(pm.brand))
                    ) AS cross_brand_verified,
                    (SELECT count(*) FROM (
                        SELECT pm2.id
                        FROM product_models pm2
                        LEFT JOIN products p2 ON p2.model_id = pm2.id
                        GROUP BY pm2.id
                        HAVING count(p2.id) > 0
                           AND count(*) FILTER (WHERE p2.is_default_variant) <> 1
                    ) bad_defaults) AS default_variant_anomalies,
                    (SELECT count(*) FROM model_mapping_reviews WHERE status = 'pending')
                        AS pending_mapping_reviews
                FROM products p
                LEFT JOIN product_models pm ON pm.id = p.model_id
            """))).one()
    snapshot_differences = {
        key: {"before": baseline.get(key), "after": current.get(key)}
        for key in baseline
        if baseline.get(key) != current.get(key)
    }
    return {
        "unmapped": row.unmapped,
        "cross_category_verified": row.cross_category_verified,
        "cross_brand_verified": row.cross_brand_verified,
        "default_variant_anomalies": row.default_variant_anomalies,
        "pending_mapping_reviews": row.pending_mapping_reviews,
        "snapshot_differences": snapshot_differences,
        "catalogue_snapshot": current,
        "passed": (
            row.unmapped == 0
            and row.cross_category_verified == 0
            and row.cross_brand_verified == 0
            and row.default_variant_anomalies == 0
            and not snapshot_differences
        ),
    }


async def run_backfill(
    db: AsyncSession,
    *,
    batch_size: int = 500,
    max_batches: int | None = None,
    resume_run_id: uuid.UUID | None = None,
) -> dict[str, Any]:
    if not 1 <= batch_size <= 5000:
        raise ValueError("batch_size must be between 1 and 5000")

    if resume_run_id:
        run = (
            await db.execute(
                text("""
                    SELECT id, baseline, batches_completed, products_processed
                    FROM model_backfill_runs
                    WHERE id = :id AND status IN ('running','failed')
                    FOR UPDATE
                """),
                {"id": resume_run_id},
            )
        ).one_or_none()
        if run is None:
            raise ValueError("resumable backfill run not found")
        run_id = run.id
        baseline = dict(run.baseline)
        batches_completed = run.batches_completed
        products_processed = run.products_processed
        await db.execute(
            text("""
                UPDATE model_backfill_runs
                SET status = 'running', error = NULL, finished_at = NULL
                WHERE id = :id
            """),
            {"id": run_id},
        )
    else:
        run_id = uuid.uuid4()
        baseline = await catalogue_snapshot(db)
        batches_completed = 0
        products_processed = 0
        await db.execute(
            text("""
                INSERT INTO model_backfill_runs (id, batch_size, baseline)
                VALUES (:id, :batch_size, CAST(:baseline AS jsonb))
            """),
            {
                "id": run_id,
                "batch_size": batch_size,
                "baseline": json.dumps(baseline),
            },
        )
    await db.commit()

    batches_this_call = 0
    try:
        while max_batches is None or batches_this_call < max_batches:
            rows = (
                await db.execute(
                    text("""
                        SELECT id, category, brand, model_family, name
                        FROM products
                        WHERE model_id IS NULL
                        ORDER BY id
                        FOR UPDATE SKIP LOCKED
                        LIMIT :limit
                    """),
                    {"limit": batch_size},
                )
            ).all()
            if not rows:
                await db.rollback()
                break

            affected_models: set[uuid.UUID] = set()
            processed_ids: set[uuid.UUID] = set()
            for row in rows:
                # An earlier candidate in this batch can map the whole exact group.
                still_unmapped = await db.scalar(
                    text("SELECT model_id IS NULL FROM products WHERE id = :id"),
                    {"id": row.id},
                )
                if not still_unmapped:
                    continue
                candidate = MappingCandidate(
                    product_id=row.id,
                    category=row.category,
                    brand=row.brand,
                    model_family=row.model_family,
                    product_name=row.name,
                )
                if candidate.is_exact:
                    model_id, mapped_ids = await _map_exact_group(db, candidate)
                else:
                    model_id, mapped_ids = await _map_provisional(db, candidate)
                affected_models.add(model_id)
                processed_ids.update(mapped_ids)

            for model_id in affected_models:
                await _select_default_variant(db, model_id)

            batches_completed += 1
            batches_this_call += 1
            products_processed += len(processed_ids)
            last_product_id = rows[-1].id
            await db.execute(
                text("""
                    UPDATE model_backfill_runs
                    SET batches_completed = :batches,
                        products_processed = :processed,
                        last_product_id = :last_product
                    WHERE id = :id
                """),
                {
                    "batches": batches_completed,
                    "processed": products_processed,
                    "last_product": last_product_id,
                    "id": run_id,
                },
            )
            await db.commit()

        remaining = await db.scalar(
            text("SELECT count(*) FROM products WHERE model_id IS NULL")
        )
        if remaining:
            return {
                "run_id": str(run_id),
                "status": "running",
                "batches_completed": batches_completed,
                "products_processed": products_processed,
                "remaining": remaining,
            }

        report = await reconciliation_report(db, baseline)
        status = "completed" if report["passed"] else "failed"
        await db.execute(
            text("""
                UPDATE model_backfill_runs
                SET status = :status, result = CAST(:result AS jsonb),
                    error = :error, finished_at = now()
                WHERE id = :id
            """),
            {
                "status": status,
                "result": json.dumps(report),
                "error": None if report["passed"] else "reconciliation failed",
                "id": run_id,
            },
        )
        await db.commit()
        return {
            "run_id": str(run_id),
            "status": status,
            "batches_completed": batches_completed,
            "products_processed": products_processed,
            "remaining": 0,
            "reconciliation": report,
        }
    except Exception as exc:
        await db.rollback()
        await db.execute(
            text("""
                UPDATE model_backfill_runs
                SET status = 'failed', error = :error, finished_at = now()
                WHERE id = :id
            """),
            {"error": str(exc)[:4000], "id": run_id},
        )
        await db.commit()
        raise

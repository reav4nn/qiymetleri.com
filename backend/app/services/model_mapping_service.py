from __future__ import annotations

import json
import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.model_backfill_service import _select_default_variant, _unique_slug


async def list_product_models(
    db: AsyncSession,
    *,
    category_id: str | None = None,
    status: str | None = None,
    query: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    filters = ["1=1"]
    params: dict[str, Any] = {"limit": limit, "offset": offset}
    if category_id:
        filters.append("pm.category_id = :category")
        params["category"] = category_id
    if status:
        filters.append("pm.status = :status")
        params["status"] = status
    if query:
        filters.append(
            "(pm.name ILIKE :query OR pm.brand ILIKE :query "
            "OR concat_ws(' ', pm.brand, pm.name) ILIKE :query)"
        )
        params["query"] = f"%{query}%"
    where = " AND ".join(filters)
    total = await db.scalar(
        text(f"SELECT count(*) FROM product_models pm WHERE {where}"), params
    )
    rows = (
        await db.execute(
            text(f"""
                SELECT pm.id, pm.category_id, pm.brand, pm.name, pm.slug, pm.status,
                       pm.readiness_score, pm.is_comparison_ready,
                       count(p.id) AS variant_count,
                       count(p.id) FILTER (WHERE p.is_default_variant) AS default_count
                FROM product_models pm
                LEFT JOIN products p ON p.model_id = pm.id
                WHERE {where}
                GROUP BY pm.id
                ORDER BY pm.brand, pm.name, pm.id
                LIMIT :limit OFFSET :offset
            """),
            params,
        )
    ).all()
    return {
        "items": [dict(row._mapping) for row in rows],
        "total": total or 0,
        "limit": limit,
        "offset": offset,
    }


async def create_product_model(
    db: AsyncSession,
    *,
    category_id: str,
    brand: str,
    name: str,
    status: str,
    actor: str,
    reason: str,
) -> dict[str, Any]:
    category_exists = await db.scalar(
        text("SELECT EXISTS(SELECT 1 FROM categories WHERE id = :id)"),
        {"id": category_id},
    )
    if not category_exists:
        raise ValueError("category not found")
    duplicate = (
        await db.execute(
            text("""
                SELECT id
                FROM product_models
                WHERE category_id = :category
                  AND lower(brand) = lower(:brand)
                  AND lower(name) = lower(:name)
                  AND status != 'archived'
                LIMIT 1
            """),
            {
                "category": category_id,
                "brand": brand.strip(),
                "name": name.strip(),
            },
        )
    ).one_or_none()
    if duplicate is not None:
        raise ValueError("product model already exists")
    model_id = uuid.uuid4()
    slug = await _unique_slug(db, brand.strip(), name.strip(), model_id)
    row = (
        await db.execute(
            text("""
                INSERT INTO product_models (id, category_id, brand, name, slug, status)
                VALUES (:id, :category, :brand, :name, :slug, :status)
                RETURNING id, category_id, brand, name, slug, status
            """),
            {
                "id": model_id,
                "category": category_id,
                "brand": brand.strip(),
                "name": name.strip(),
                "slug": slug,
                "status": status,
            },
        )
    ).one()
    await db.execute(
        text("""
            INSERT INTO spec_audit_events
                (actor, action, entity_type, entity_id, after, reason)
            VALUES (:actor, 'create', 'product_model', :entity_id,
                    CAST(:after AS jsonb), :reason)
        """),
        {
            "actor": actor,
            "entity_id": str(model_id),
            "after": json.dumps(dict(row._mapping), default=str),
            "reason": reason.strip(),
        },
    )
    await db.commit()
    return dict(row._mapping)


async def merge_product_models(
    db: AsyncSession,
    *,
    source_model_id: uuid.UUID,
    target_model_id: uuid.UUID,
    actor: str,
    reason: str,
) -> dict[str, Any] | None:
    if source_model_id == target_model_id:
        raise ValueError("source and target models must be different")

    rows = (
        await db.execute(
            text("""
                SELECT id, category_id, brand, name, slug, status
                FROM product_models
                WHERE id IN (:source, :target)
                ORDER BY id
                FOR UPDATE
            """),
            {"source": source_model_id, "target": target_model_id},
        )
    ).all()
    models = {row.id: row for row in rows}
    source = models.get(source_model_id)
    target = models.get(target_model_id)
    if source is None:
        return None
    if target is None:
        raise ValueError("target model not found")
    if source.status == "archived":
        raise ValueError("source model is already archived")
    if target.status != "verified":
        raise ValueError("target model must be verified")
    if source.category_id != target.category_id:
        raise ValueError("models must belong to the same category")

    dependent_count = await db.scalar(
        text("""
            SELECT
                (SELECT count(*) FROM spec_observations WHERE model_id = :source)
              + (SELECT count(*) FROM canonical_spec_values WHERE model_id = :source)
              + (SELECT count(*) FROM comparison_pages
                 WHERE model_a_id = :source OR model_b_id = :source)
        """),
        {"source": source_model_id},
    )
    if dependent_count:
        raise ValueError(
            "source model has specs or comparison pages; resolve them before merge"
        )

    moved_count = await db.scalar(
        text("SELECT count(*) FROM products WHERE model_id = :source"),
        {"source": source_model_id},
    )
    before = {
        "source": dict(source._mapping),
        "target": dict(target._mapping),
        "moved_products": moved_count or 0,
    }

    await db.execute(
        text("""
            UPDATE products
            SET model_id = :target,
                is_default_variant = false,
                brand = :brand,
                category = :category,
                model_family = :model_name
            WHERE model_id = :source
        """),
        {
            "source": source_model_id,
            "target": target_model_id,
            "brand": target.brand,
            "category": target.category_id,
            "model_name": target.name,
        },
    )
    await db.execute(
        text("""
            UPDATE model_mapping_reviews
            SET current_model_id = :target
            WHERE current_model_id = :source AND status = 'pending'
        """),
        {"source": source_model_id, "target": target_model_id},
    )
    await db.execute(
        text("""
            UPDATE model_mapping_reviews
            SET proposed_model_id = :target
            WHERE proposed_model_id = :source AND status = 'pending'
        """),
        {"source": source_model_id, "target": target_model_id},
    )
    await db.execute(
        text("""
            INSERT INTO product_model_slug_aliases
                (alias, model_id, reason, created_by)
            VALUES (:alias, :target, :reason, :actor)
            ON CONFLICT (alias) DO UPDATE
            SET model_id = EXCLUDED.model_id,
                reason = EXCLUDED.reason,
                created_by = EXCLUDED.created_by
        """),
        {
            "alias": source.slug,
            "target": target_model_id,
            "reason": reason.strip(),
            "actor": actor,
        },
    )
    await db.execute(
        text("""
            UPDATE product_models
            SET status = 'archived', is_comparison_ready = false,
                updated_at = now()
            WHERE id = :source
        """),
        {"source": source_model_id},
    )
    await db.execute(
        text("DELETE FROM spec_readiness_queue WHERE model_id = :source"),
        {"source": source_model_id},
    )
    await _select_default_variant(db, target_model_id)

    result = {
        "source_model_id": source_model_id,
        "target_model_id": target_model_id,
        "moved_products": moved_count or 0,
        "source_status": "archived",
    }
    await db.execute(
        text("""
            INSERT INTO spec_audit_events
                (actor, action, entity_type, entity_id, before, after, reason)
            VALUES (:actor, 'merge', 'product_model', :entity_id,
                    CAST(:before AS jsonb), CAST(:after AS jsonb), :reason)
        """),
        {
            "actor": actor,
            "entity_id": str(source_model_id),
            "before": json.dumps(before, default=str),
            "after": json.dumps(result, default=str),
            "reason": reason.strip(),
        },
    )
    await db.commit()
    return result


async def list_mapping_reviews(
    db: AsyncSession,
    *,
    status: str = "pending",
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    params = {"status": status, "limit": limit, "offset": offset}
    total = await db.scalar(
        text("SELECT count(*) FROM model_mapping_reviews WHERE status = :status"),
        params,
    )
    rows = (
        await db.execute(
            text("""
                SELECT r.id, r.status, r.confidence, r.reason, r.created_at,
                       r.reviewer, r.resolution_reason, r.reviewed_at,
                       p.id AS product_id, p.name AS product_name,
                       p.canonical_id, p.brand AS product_brand,
                       p.category AS product_category,
                       p.model_family,
                       current.id AS current_model_id,
                       current.brand AS current_model_brand,
                       current.name AS current_model_name,
                       current.status AS current_model_status,
                       proposed.id AS proposed_model_id,
                       proposed.brand AS proposed_model_brand,
                       proposed.name AS proposed_model_name,
                       proposed.status AS proposed_model_status
                FROM model_mapping_reviews r
                JOIN products p ON p.id = r.product_id
                LEFT JOIN product_models current ON current.id = r.current_model_id
                LEFT JOIN product_models proposed ON proposed.id = r.proposed_model_id
                WHERE r.status = :status
                ORDER BY r.created_at, r.id
                LIMIT :limit OFFSET :offset
            """),
            params,
        )
    ).all()
    return {
        "items": [dict(row._mapping) for row in rows],
        "total": total or 0,
        "limit": limit,
        "offset": offset,
    }


async def resolve_mapping_review(
    db: AsyncSession,
    *,
    review_id: uuid.UUID,
    action: str,
    target_model_id: uuid.UUID | None,
    actor: str,
    reason: str,
) -> dict[str, Any] | None:
    review = (
        await db.execute(
            text("""
                SELECT id, product_id, proposed_model_id, current_model_id,
                       confidence, reason, status
                FROM model_mapping_reviews
                WHERE id = :id
                FOR UPDATE
            """),
            {"id": review_id},
        )
    ).one_or_none()
    if review is None:
        return None
    if review.status != "pending":
        raise ValueError("mapping review is already resolved")

    before = dict(review._mapping)
    if action == "reject":
        await db.execute(
            text("""
                UPDATE model_mapping_reviews
                SET status = 'rejected', reviewer = :actor,
                    resolution_reason = :reason, reviewed_at = now()
                WHERE id = :id
            """),
            {"actor": actor, "reason": reason.strip(), "id": review_id},
        )
        result = {"id": review_id, "status": "rejected"}
    else:
        target_id = target_model_id or review.proposed_model_id
        if target_id is None:
            raise ValueError("target_model_id is required for assign")
        product = (
            await db.execute(
                text("""
                    SELECT id, model_id, brand, category, model_family
                    FROM products WHERE id = :id FOR UPDATE
                """),
                {"id": review.product_id},
            )
        ).one()
        if product.model_id != review.current_model_id:
            raise ValueError("product mapping changed after this review was created")
        target = (
            await db.execute(
                text("""
                    SELECT id, category_id, brand, name, status
                    FROM product_models WHERE id = :id
                """),
                {"id": target_id},
            )
        ).one_or_none()
        if target is None:
            raise ValueError("target model not found")
        if (product.category or "").strip().lower() != target.category_id:
            raise ValueError("target model category does not match product category")
        if (
            target.status == "verified"
            and product.brand
            and product.brand.strip().lower() != target.brand.strip().lower()
        ):
            raise ValueError("verified target model brand does not match product brand")

        await db.execute(
            text("""
                UPDATE products
                SET model_id = :target,
                    is_default_variant = false,
                    brand = :brand,
                    category = :category,
                    model_family = :model_name
                WHERE id = :product
            """),
            {
                "target": target.id,
                "brand": target.brand,
                "category": target.category_id,
                "model_name": target.name,
                "product": product.id,
            },
        )
        await _select_default_variant(db, target.id)
        if review.current_model_id and review.current_model_id != target.id:
            remaining = await db.scalar(
                text("SELECT count(*) FROM products WHERE model_id = :id"),
                {"id": review.current_model_id},
            )
            if remaining:
                await _select_default_variant(db, review.current_model_id)
            else:
                await db.execute(
                    text("""
                        UPDATE product_models SET status = 'archived'
                        WHERE id = :id AND status = 'provisional'
                    """),
                    {"id": review.current_model_id},
                )
        await db.execute(
            text("""
                UPDATE model_mapping_reviews
                SET status = 'accepted', proposed_model_id = :target,
                    reviewer = :actor, resolution_reason = :reason,
                    reviewed_at = now()
                WHERE id = :id
            """),
            {
                "target": target.id,
                "actor": actor,
                "reason": reason.strip(),
                "id": review_id,
            },
        )
        result = {
            "id": review_id,
            "status": "accepted",
            "product_id": product.id,
            "model_id": target.id,
        }

    await db.execute(
        text("""
            INSERT INTO spec_audit_events
                (actor, action, entity_type, entity_id, before, after, reason)
            VALUES (:actor, :action, 'model_mapping_review', :entity_id,
                    CAST(:before AS jsonb), CAST(:after AS jsonb), :reason)
        """),
        {
            "actor": actor,
            "action": action,
            "entity_id": str(review_id),
            "before": json.dumps(before, default=str),
            "after": json.dumps(result, default=str),
            "reason": reason.strip(),
        },
    )
    await db.commit()
    return result

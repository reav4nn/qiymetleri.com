from sqlalchemy import func, select, text as sa_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import CurrentPrice, PriceHistory, Product, Store


async def get_dashboard_stats(db: AsyncSession) -> dict:
    product_count = await db.scalar(select(func.count(Product.id)))
    variant_count = await db.scalar(
        select(func.count(func.distinct(func.lower(Product.model_family)))).where(
            Product.model_family.isnot(None)
        )
    )
    store_result = await db.execute(
        select(func.count(Store.id), func.count(Store.id).filter(Store.is_active))
    )
    store_row = store_result.one()
    total_stores, active_stores = store_row[0], store_row[1]

    price_stats = await db.execute(
        select(
            func.count(CurrentPrice.id),
            func.min(CurrentPrice.price_azn),
            func.max(CurrentPrice.price_azn),
        )
    )
    price_row = price_stats.one()
    total_prices, price_min, price_max = price_row

    images_count = await db.scalar(
        select(func.count(Product.id)).where(Product.image_url.isnot(None))
    )

    last_update = await db.scalar(select(func.max(CurrentPrice.last_checked_at)))

    cat_result = await db.execute(
        select(Product.category, func.count(Product.id))
        .where(Product.category.isnot(None))
        .group_by(Product.category)
        .order_by(func.count(Product.id).desc())
    )
    categories = [{"name": row[0], "count": row[1]} for row in cat_result.all()]

    return {
        "total_products": product_count or 0,
        "total_variants": variant_count or 0,
        "total_stores": total_stores,
        "active_stores": active_stores,
        "total_prices": total_prices or 0,
        "price_range_min": float(price_min) if price_min else None,
        "price_range_max": float(price_max) if price_max else None,
        "products_with_images": images_count or 0,
        "last_price_update": last_update,
        "categories": categories,
    }


async def get_store_health(db: AsyncSession) -> list[dict]:
    stores_result = await db.execute(select(Store).order_by(Store.name))
    stores = stores_result.scalars().all()

    health_list = []
    for store in stores:
        stats = await db.execute(
            select(
                func.count(CurrentPrice.id),
                func.count(CurrentPrice.id).filter(CurrentPrice.in_stock),
                func.avg(CurrentPrice.price_azn),
                func.min(CurrentPrice.price_azn),
                func.max(CurrentPrice.price_azn),
                func.max(CurrentPrice.last_checked_at),
            ).where(CurrentPrice.store_id == store.id)
        )
        row = stats.one()

        last_price_update = await db.scalar(
            select(func.max(PriceHistory.time)).where(PriceHistory.store_id == store.id)
        )

        health_list.append(
            {
                "id": store.id,
                "name": store.name,
                "base_url": store.base_url,
                "is_active": store.is_active,
                "product_count": row[0],
                "in_stock_count": row[1],
                "avg_price": round(float(row[2]), 2) if row[2] else None,
                "min_price": float(row[3]) if row[3] else None,
                "max_price": float(row[4]) if row[4] else None,
                "last_crawl": row[5],
                "last_price_update": last_price_update,
            }
        )

    return health_list


async def get_recent_products(
    db: AsyncSession, minutes: int = 60, store_id: str | None = None
) -> list[dict]:
    """Get products added or updated recently, optionally filtered by store."""
    where_clause = "WHERE cp.last_checked_at > NOW() - make_interval(mins => :minutes)"
    params: dict = {"minutes": minutes}

    if store_id is not None:
        where_clause += " AND s.id = :store_id"
        params["store_id"] = store_id

    query = sa_text(f"""
        SELECT
            p.id::text,
            p.name,
            p.brand,
            p.category,
            p.image_url,
            p.created_at,
            cp.price_azn,
            cp.url,
            cp.in_stock,
            s.name AS store_name,
            s.id AS store_id
        FROM products p
        JOIN current_prices cp ON cp.product_id = p.id
        JOIN stores s ON s.id = cp.store_id
        {where_clause}
        ORDER BY cp.last_checked_at DESC
        LIMIT 100
    """)

    result = await db.execute(query, params)
    rows = result.all()

    return [
        {
            "product_id": row[0],
            "name": row[1],
            "brand": row[2],
            "category": row[3],
            "image_url": row[4],
            "created_at": row[5],
            "price": float(row[6]) if row[6] else None,
            "url": row[7],
            "in_stock": row[8],
            "store_name": row[9],
            "store_id": row[10],
        }
        for row in rows
    ]


async def get_price_anomalies(
    db: AsyncSession, threshold_pct: float = 30.0, hours: int = 24
) -> list[dict]:
    """Detect products where price changed by more than threshold_pct in recent hours."""
    query = sa_text("""
        WITH recent_changes AS (
            SELECT
                ph.product_id,
                ph.store_id,
                ph.price_azn AS new_price,
                ph.time AS detected_at,
                LAG(ph.price_azn) OVER (
                    PARTITION BY ph.product_id, ph.store_id ORDER BY ph.time
                ) AS old_price
            FROM price_history ph
            WHERE ph.time > NOW() - make_interval(hours => :hours)
        )
        SELECT
            rc.product_id::text,
            p.name,
            rc.store_id,
            rc.old_price,
            rc.new_price,
            ROUND(ABS(rc.new_price - rc.old_price) / NULLIF(rc.old_price, 0) * 100, 1) AS change_pct,
            rc.detected_at
        FROM recent_changes rc
        JOIN products p ON p.id = rc.product_id
        WHERE rc.old_price IS NOT NULL
          AND rc.old_price > 0
          AND ABS(rc.new_price - rc.old_price) / rc.old_price * 100 > :threshold
        ORDER BY change_pct DESC
        LIMIT 100
    """)

    result = await db.execute(query, {"hours": hours, "threshold": threshold_pct})
    rows = result.all()

    return [
        {
            "product_id": row[0],
            "product_name": row[1],
            "store_id": row[2],
            "old_price": float(row[3]),
            "new_price": float(row[4]),
            "change_pct": float(row[5]),
            "detected_at": row[6],
        }
        for row in rows
    ]


async def get_pending_matches(db: AsyncSession, limit: int = 50) -> list[dict]:
    """Get product matches pending review, with example products from each family."""
    query = sa_text("""
        SELECT
            pm.id,
            pm.family_a,
            pm.family_b,
            pm.brand,
            pm.similarity,
            pm.status,
            pm.created_at,
            (SELECT string_agg(DISTINCT cp.store_id, ', ')
             FROM products p JOIN current_prices cp ON cp.product_id = p.id
             WHERE p.model_family = pm.family_a AND p.brand = pm.brand) AS stores_a,
            (SELECT string_agg(DISTINCT cp.store_id, ', ')
             FROM products p JOIN current_prices cp ON cp.product_id = p.id
             WHERE p.model_family = pm.family_b AND p.brand = pm.brand) AS stores_b,
            (SELECT COUNT(*) FROM products p
             WHERE p.model_family = pm.family_a AND p.brand = pm.brand) AS count_a,
            (SELECT COUNT(*) FROM products p
             WHERE p.model_family = pm.family_b AND p.brand = pm.brand) AS count_b,
            (SELECT json_agg(json_build_object(
                'name', sub.name, 'store_id', sub.store_id, 'url', sub.url, 'price', sub.price_azn
             )) FROM (
                SELECT p.name, cp.store_id, cp.url, cp.price_azn
                FROM products p JOIN current_prices cp ON cp.product_id = p.id
                WHERE p.model_family = pm.family_a AND p.brand = pm.brand
                ORDER BY cp.price_azn LIMIT 5
             ) sub) AS products_a,
            (SELECT json_agg(json_build_object(
                'name', sub.name, 'store_id', sub.store_id, 'url', sub.url, 'price', sub.price_azn
             )) FROM (
                SELECT p.name, cp.store_id, cp.url, cp.price_azn
                FROM products p JOIN current_prices cp ON cp.product_id = p.id
                WHERE p.model_family = pm.family_b AND p.brand = pm.brand
                ORDER BY cp.price_azn LIMIT 5
             ) sub) AS products_b
        FROM product_matches pm
        WHERE pm.status = 'pending'
        ORDER BY pm.similarity DESC
        LIMIT :limit
    """)
    result = await db.execute(query, {"limit": limit})
    rows = result.all()

    return [
        {
            "id": row[0],
            "family_a": row[1],
            "family_b": row[2],
            "brand": row[3],
            "similarity": float(row[4]),
            "status": row[5],
            "created_at": row[6],
            "stores_a": row[7],
            "stores_b": row[8],
            "count_a": row[9],
            "count_b": row[10],
            "products_a": row[11] or [],
            "products_b": row[12] or [],
        }
        for row in rows
    ]


async def get_match_stats(db: AsyncSession) -> dict:
    """Get statistics about product matches."""
    query = sa_text("""
        SELECT status, COUNT(*) FROM product_matches GROUP BY status
    """)
    result = await db.execute(query)
    stats = {row[0]: row[1] for row in result.all()}
    return {
        "pending": stats.get("pending", 0),
        "accepted": stats.get("accepted", 0),
        "rejected": stats.get("rejected", 0),
        "total": sum(stats.values()),
    }


async def review_match(db: AsyncSession, match_id: int, action: str) -> dict | None:
    """Accept or reject a product match.

    On accept: merge model_family of family_b into family_a (shorter/cleaner name).
    On reject: mark as rejected.
    """
    row = await db.execute(
        sa_text(
            "SELECT id, family_a, family_b, brand FROM product_matches WHERE id = :id"
        ),
        {"id": match_id},
    )
    match = row.first()
    if not match:
        return None

    _, family_a, family_b, brand = match

    if action == "accept":
        # Pick shorter/cleaner name as canonical
        canonical = family_a if len(family_a) <= len(family_b) else family_b
        other = family_b if canonical == family_a else family_a

        await db.execute(
            sa_text("""
                UPDATE products SET model_family = :canonical
                WHERE model_family = :other AND brand = :brand
            """),
            {"canonical": canonical, "other": other, "brand": brand},
        )
        await db.execute(
            sa_text("""
                UPDATE product_matches
                SET status = 'accepted', merged_family = :canonical, reviewed_at = NOW()
                WHERE id = :id
            """),
            {"canonical": canonical, "id": match_id},
        )
    else:
        await db.execute(
            sa_text(
                "UPDATE product_matches SET status = 'rejected', reviewed_at = NOW() WHERE id = :id"
            ),
            {"id": match_id},
        )

    await db.commit()
    return {
        "id": match_id,
        "status": action + "ed",
        "family_a": family_a,
        "family_b": family_b,
    }

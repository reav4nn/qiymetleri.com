from datetime import datetime

from sqlalchemy import func, select, text as sa_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import CurrentPrice, PriceHistory, Product, Store


async def get_dashboard_stats(db: AsyncSession) -> dict:
    product_count = await db.scalar(select(func.count(Product.id)))
    variant_count = await db.scalar(
        select(func.count(func.distinct(func.lower(Product.model_family))))
        .where(Product.model_family.isnot(None))
    )
    store_result = await db.execute(select(func.count(Store.id), func.count(Store.id).filter(Store.is_active)))
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

    last_update = await db.scalar(
        select(func.max(CurrentPrice.last_checked_at))
    )

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
            select(func.max(PriceHistory.time))
            .where(PriceHistory.store_id == store.id)
        )

        health_list.append({
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
        })

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

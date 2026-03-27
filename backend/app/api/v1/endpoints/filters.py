from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import get_cache, set_cache
from app.core.database import get_db
from app.models.product import CurrentPrice, Product, Store

router = APIRouter()

FILTERS_CACHE_KEY = "filters:all"
FILTERS_TTL = 3600  # 1 hour — changes only on scraper runs


@router.get("")
async def get_filters(db: AsyncSession = Depends(get_db)):
    """Return available filter options: brands, stores, categories, price range."""

    cached = await get_cache(FILTERS_CACHE_KEY)
    if cached:
        return cached

    brands_q = (
        select(Product.brand, func.count(Product.id).label("count"))
        .where(Product.brand.isnot(None))
        .group_by(Product.brand)
        .order_by(func.count(Product.id).desc())
    )
    brands_result = await db.execute(brands_q)
    brands = [{"id": r.brand, "name": r.brand, "count": r.count} for r in brands_result]

    stores_q = (
        select(
            Store.id,
            Store.name,
            func.count(CurrentPrice.id).label("count"),
        )
        .join(CurrentPrice, CurrentPrice.store_id == Store.id)
        .where(Store.is_active.is_(True))
        .group_by(Store.id, Store.name)
        .order_by(func.count(CurrentPrice.id).desc())
    )
    stores_result = await db.execute(stores_q)
    stores = [{"id": r.id, "name": r.name, "count": r.count} for r in stores_result]

    categories_q = (
        select(Product.category, func.count(Product.id).label("count"))
        .where(Product.category.isnot(None))
        .group_by(Product.category)
        .order_by(func.count(Product.id).desc())
    )
    categories_result = await db.execute(categories_q)
    categories = [
        {"id": r.category, "name": r.category, "count": r.count}
        for r in categories_result
    ]

    price_q = select(
        func.min(CurrentPrice.price_azn).label("min_price"),
        func.max(CurrentPrice.price_azn).label("max_price"),
    ).where(CurrentPrice.in_stock.is_(True))
    price_result = await db.execute(price_q)
    price_row = price_result.first()

    result = {
        "brands": brands,
        "stores": stores,
        "categories": categories,
        "price_range": {
            "min": float(price_row.min_price) if price_row and price_row.min_price else 0,
            "max": float(price_row.max_price) if price_row and price_row.max_price else 0,
        },
    }

    await set_cache(FILTERS_CACHE_KEY, result, ttl=FILTERS_TTL)
    return result

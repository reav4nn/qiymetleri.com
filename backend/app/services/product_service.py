from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.product import CurrentPrice, PriceHistory, Product


async def get_products(
    db: AsyncSession,
    *,
    page: int = 1,
    per_page: int = 20,
    category: str | None = None,
    brand: str | None = None,
    store_id: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    sort_by: str = "name",
    q: str | None = None,
) -> tuple[list[dict], int]:
    query = select(Product).options(selectinload(Product.current_prices))

    if category:
        query = query.where(Product.category == category)
    if brand:
        query = query.where(Product.brand == brand)
    if q:
        query = query.where(Product.name.ilike(f"%{q}%"))

    if store_id or min_price is not None or max_price is not None:
        query = query.join(CurrentPrice)
        if store_id:
            query = query.where(CurrentPrice.store_id == store_id)
        if min_price is not None:
            query = query.where(CurrentPrice.price_azn >= min_price)
        if max_price is not None:
            query = query.where(CurrentPrice.price_azn <= max_price)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Sort
    if sort_by == "price_asc":
        query = query.order_by(
            func.min(CurrentPrice.price_azn).asc()
            if CurrentPrice in [c.entity for c in query.column_descriptions]
            else Product.name
        )
    elif sort_by == "price_desc":
        query = query.order_by(Product.name.desc())
    else:
        query = query.order_by(Product.name)

    # Paginate
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    products = result.scalars().unique().all()

    items = []
    for p in products:
        prices = [cp.price_azn for cp in p.current_prices if cp.in_stock]
        items.append(
            {
                "id": p.id,
                "canonical_id": p.canonical_id,
                "brand": p.brand,
                "category": p.category,
                "model_family": p.model_family,
                "name": p.name,
                "lowest_price": min(prices) if prices else None,
                "store_count": len(p.current_prices),
            }
        )

    return items, total


async def get_product_by_id(db: AsyncSession, product_id: UUID) -> Product | None:
    query = (
        select(Product)
        .options(selectinload(Product.current_prices))
        .where(Product.id == product_id)
    )
    result = await db.execute(query)
    return result.scalars().first()


async def get_price_history(
    db: AsyncSession,
    product_id: UUID,
    days: int = 30,
) -> list[PriceHistory]:
    from sqlalchemy import text as sa_text

    query = (
        select(PriceHistory)
        .where(PriceHistory.product_id == product_id)
        .where(
            PriceHistory.time >= func.now() - sa_text(f"interval '{days} days'")
        )
        .order_by(PriceHistory.time)
    )
    result = await db.execute(query)
    return list(result.scalars().all())


async def search_products(
    db: AsyncSession,
    q: str,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[dict], int]:
    return await get_products(db, q=q, page=page, per_page=per_page)

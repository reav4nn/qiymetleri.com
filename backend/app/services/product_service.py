from collections import defaultdict
from uuid import UUID

from sqlalchemy import func, select, text as sa_text
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
    """Return products grouped by model_family.
    
    Products with the same model_family are collapsed into one entry
    showing the lowest price across all variants and stores.
    """
    query = select(Product).options(selectinload(Product.current_prices))

    if category:
        query = query.where(Product.category == category)
    if brand:
        query = query.where(Product.brand == brand)
    if q:
        query = query.where(Product.name.ilike(f"%{q}%"))

    price_join_needed = store_id or min_price is not None or max_price is not None
    if price_join_needed:
        query = query.join(CurrentPrice)
        if store_id:
            query = query.where(CurrentPrice.store_id == store_id)
        if min_price is not None:
            query = query.where(CurrentPrice.price_azn >= min_price)
        if max_price is not None:
            query = query.where(CurrentPrice.price_azn <= max_price)

    # Fetch all matching products (before pagination, for grouping)
    result = await db.execute(query)
    all_products = result.scalars().unique().all()

    # Group by model_family (case-insensitive)
    families: dict[str, list[Product]] = defaultdict(list)
    for p in all_products:
        key = (p.model_family or p.canonical_id).lower()
        families[key].append(p)

    # Build grouped items
    grouped_items = []
    for family_key, members in families.items():
        all_prices = []
        all_store_ids = set()
        for m in members:
            for cp in m.current_prices:
                if cp.in_stock:
                    all_prices.append(cp.price_azn)
                all_store_ids.add(cp.store_id)

        # Use first member as the representative
        rep = members[0]
        grouped_items.append(
            {
                "id": rep.id,
                "canonical_id": rep.canonical_id,
                "brand": rep.brand,
                "category": rep.category,
                "model_family": rep.model_family,
                "name": rep.model_family or rep.name,
                "lowest_price": min(all_prices) if all_prices else None,
                "store_count": len(all_store_ids),
                "variant_count": len(members),
            }
        )

    # Sort grouped items
    if sort_by == "price_asc":
        grouped_items.sort(
            key=lambda x: (x["lowest_price"] is None, x["lowest_price"] or 0)
        )
    elif sort_by == "price_desc":
        grouped_items.sort(
            key=lambda x: (x["lowest_price"] is None, -(x["lowest_price"] or 0))
        )
    else:
        grouped_items.sort(key=lambda x: x["name"].lower())

    total = len(grouped_items)

    # Paginate
    start = (page - 1) * per_page
    end = start + per_page
    page_items = grouped_items[start:end]

    return page_items, total


async def get_product_by_id(db: AsyncSession, product_id: UUID) -> Product | None:
    query = (
        select(Product)
        .options(selectinload(Product.current_prices))
        .where(Product.id == product_id)
    )
    result = await db.execute(query)
    return result.scalars().first()


async def get_family_variants(
    db: AsyncSession, product: Product
) -> list[Product]:
    """Get all products in the same model_family (case-insensitive)."""
    if not product.model_family:
        return [product]

    query = (
        select(Product)
        .options(selectinload(Product.current_prices))
        .where(func.lower(Product.model_family) == product.model_family.lower())
        .order_by(Product.name)
    )
    result = await db.execute(query)
    return list(result.scalars().unique().all())


async def get_price_history(
    db: AsyncSession,
    product_id: UUID,
    days: int = 30,
) -> list[PriceHistory]:
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

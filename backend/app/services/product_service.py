from collections import defaultdict
import re
from uuid import UUID

from sqlalchemy import Float, case, cast, func, literal, select, text as sa_text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.product import CurrentPrice, PriceHistory, Product

# Minimum trigram similarity to consider a match
TRGM_THRESHOLD = 0.15
# Weight distribution: FTS rank vs trigram similarity
FTS_WEIGHT = 0.6
TRGM_WEIGHT = 0.4

# Common AZ/RU transliterations and aliases → canonical search terms
_SEARCH_ALIASES: dict[str, str] = {
    # Azerbaijani transliterations
    "ayfon": "iphone",
    "aypad": "ipad",
    "makbuk": "macbook",
    "mekbuk": "macbook",
    "eyrpods": "airpods",
    "eyrpodz": "airpods",
    "qulaqliq": "headphones",
    "qulaqlıq": "headphones",
    "notbuk": "laptop",
    "noutbuk": "laptop",
    "saat": "watch",
    "planset": "tablet",
    "planşet": "tablet",
    "samsung": "samsung",
    "huavey": "huawei",
    "syaomi": "xiaomi",
    "redmi": "redmi",
    "realmi": "realme",
    # Russian transliterations
    "айфон": "iphone",
    "айпад": "ipad",
    "макбук": "macbook",
    "самсунг": "samsung",
    "хуавей": "huawei",
    "сяоми": "xiaomi",
    "наушники": "headphones",
    "ноутбук": "laptop",
    "часы": "watch",
    "планшет": "tablet",
}


def _normalize_search_query(q: str) -> str:
    """Translate common AZ/RU aliases to canonical English terms."""
    words = q.strip().split()
    result = []
    for w in words:
        lower = w.lower()
        result.append(_SEARCH_ALIASES.get(lower, w))
    return " ".join(result)


def _build_fuzzy_query(q: str):
    """Build a hybrid fuzzy search query combining trigram + full-text search.

    Returns (filter_clause, score_column) for use in SELECT/WHERE/ORDER BY.
    Uses pg_trgm similarity on product name + ts_rank on search_vector.
    Falls back to ILIKE if both return nothing.
    """
    tsquery = func.plainto_tsquery(sa_text("'simple'::regconfig"), q)
    trgm_sim = func.similarity(Product.name, q)
    fts_rank = func.ts_rank(Product.search_vector, tsquery)

    hybrid_score = (
        cast(trgm_sim, Float) * TRGM_WEIGHT
        + cast(fts_rank, Float) * FTS_WEIGHT
    )

    filter_clause = (trgm_sim >= TRGM_THRESHOLD) | (
        Product.search_vector.op("@@")(tsquery)
    )

    return filter_clause, hybrid_score, trgm_sim


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
    chip: str | None = None,
    size_mm: int | None = None,
) -> tuple[list[dict], int]:
    """Return products grouped by model_family.

    Products with the same model_family are collapsed into one entry
    showing the lowest price across all variants and stores.
    When ``q`` is provided, uses hybrid fuzzy search (pg_trgm + FTS).
    """
    use_fuzzy = bool(q and len(q) >= 2)
    score_col = None

    if use_fuzzy:
        q = _normalize_search_query(q)
        filter_clause, hybrid_score, trgm_sim = _build_fuzzy_query(q)
        score_col = hybrid_score.label("_score")
        query = (
            select(Product, score_col)
            .options(selectinload(Product.current_prices))
            .where(filter_clause)
        )
    else:
        query = select(Product).options(selectinload(Product.current_prices))
        if q:
            query = query.where(Product.name.ilike(f"%{q}%"))

    if category:
        query = query.where(Product.category == category)
    if brand:
        query = query.where(Product.brand == brand)
    if chip:
        query = query.where(Product.attributes["chip"].astext == chip)
    if size_mm is not None:
        query = query.where(
            Product.attributes["size_mm"].astext == str(size_mm)
        )

    price_join_needed = store_id or min_price is not None or max_price is not None
    if price_join_needed:
        query = query.join(CurrentPrice)
        if store_id:
            query = query.where(CurrentPrice.store_id == store_id)
        if min_price is not None:
            query = query.where(CurrentPrice.price_azn >= min_price)
        if max_price is not None:
            query = query.where(CurrentPrice.price_azn <= max_price)

    result = await db.execute(query)

    if use_fuzzy:
        rows = result.unique().all()
        products_with_score: list[tuple[Product, float]] = [
            (row[0], float(row[1])) for row in rows
        ]
    else:
        all_products = result.scalars().unique().all()
        products_with_score = [(p, 0.0) for p in all_products]

    # Group by model_family (case-insensitive)
    families: dict[str, list[tuple[Product, float]]] = defaultdict(list)
    for p, score in products_with_score:
        key = (p.model_family or p.canonical_id).lower()
        families[key].append((p, score))

    # Build grouped items
    grouped_items = []
    for family_key, members in families.items():
        all_prices = []
        all_store_ids = set()
        best_score = max(s for _, s in members)

        for m, _ in members:
            for cp in m.current_prices:
                if cp.in_stock:
                    all_prices.append(cp.price_azn)
                all_store_ids.add(cp.store_id)

        rep = members[0][0]
        grouped_items.append(
            {
                "id": rep.id,
                "canonical_id": rep.canonical_id,
                "brand": rep.brand,
                "category": rep.category,
                "model_family": rep.model_family,
                "name": rep.model_family or rep.name,
                "image_url": next(
                    (m.image_url for m, _ in members if m.image_url), None
                ),
                "lowest_price": min(all_prices) if all_prices else None,
                "store_count": len(all_store_ids),
                "variant_count": len(members),
                "_score": best_score,
            }
        )

    # Sort grouped items
    if use_fuzzy and sort_by == "name":
        # When searching, sort by relevance instead of alphabetical
        grouped_items.sort(key=lambda x: -x["_score"])
    elif sort_by == "price_asc":
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

    # Remove internal score from response
    for item in page_items:
        item.pop("_score", None)

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
    product_ids: UUID | list[UUID],
    days: int = 30,
) -> list[PriceHistory]:
    if isinstance(product_ids, list):
        id_filter = PriceHistory.product_id.in_(product_ids)
    else:
        id_filter = PriceHistory.product_id == product_ids

    query = (
        select(PriceHistory)
        .where(id_filter)
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

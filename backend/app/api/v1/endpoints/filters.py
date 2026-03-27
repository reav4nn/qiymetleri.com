import hashlib

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, text as sa_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import get_cache, set_cache
from app.core.database import get_db
from app.models.product import CurrentPrice, Product, Store

router = APIRouter()

FILTERS_TTL = 3600  # 1 hour


def _filters_cache_key(
    q: str | None,
    category: str | None,
    brand: str | None,
    store_id: str | None,
    min_price: float | None,
    max_price: float | None,
) -> str:
    raw = f"{q}:{category}:{brand}:{store_id}:{min_price}:{max_price}"
    h = hashlib.md5(raw.encode()).hexdigest()[:12]
    return f"filters:{h}"


# Minimum trigram similarity (same as product_service)
_TRGM_THRESHOLD = 0.15

# Same aliases as product_service for consistency
_SEARCH_ALIASES: dict[str, str] = {
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
    "huavey": "huawei",
    "syaomi": "xiaomi",
    "realmi": "realme",
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


def _normalize_q(q: str) -> str:
    words = q.strip().split()
    return " ".join(_SEARCH_ALIASES.get(w.lower(), w) for w in words)


@router.get("")
async def get_filters(
    q: str | None = Query(None, max_length=200),
    category: str | None = None,
    brand: str | None = None,
    store_id: str | None = None,
    min_price: float | None = Query(None, ge=0),
    max_price: float | None = Query(None, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Return available filter options scoped to the current search context."""

    cache_key = _filters_cache_key(q, category, brand, store_id, min_price, max_price)
    cached = await get_cache(cache_key)
    if cached:
        return cached

    # Build a CTE of product IDs matching the current context
    # so all aggregations are scoped to relevant products
    base = select(Product.id.label("pid"))

    if q and len(q) >= 2:
        nq = _normalize_q(q)
        tsquery = func.plainto_tsquery(sa_text("'simple'::regconfig"), nq)
        trgm_sim = func.similarity(Product.name, nq)
        base = base.where(
            (trgm_sim >= _TRGM_THRESHOLD) | Product.search_vector.op("@@")(tsquery)
        )
    elif q:
        base = base.where(Product.name.ilike(f"%{q}%"))

    if category:
        base = base.where(Product.category == category)

    # Price/store filtering requires join to current_prices
    if store_id or min_price is not None or max_price is not None:
        base = base.join(CurrentPrice, CurrentPrice.product_id == Product.id)
        if store_id:
            base = base.where(CurrentPrice.store_id == store_id)
        if min_price is not None:
            base = base.where(CurrentPrice.price_azn >= min_price)
        if max_price is not None:
            base = base.where(CurrentPrice.price_azn <= max_price)

    ctx = base.cte("ctx")

    # --- Brands (scoped) ---
    brands_q = (
        select(Product.brand, func.count(Product.id).label("count"))
        .join(ctx, Product.id == ctx.c.pid)
        .where(Product.brand.isnot(None))
        .group_by(Product.brand)
        .order_by(func.count(Product.id).desc())
    )
    brands_result = await db.execute(brands_q)
    brands = [{"id": r.brand, "name": r.brand, "count": r.count} for r in brands_result]

    # --- Stores (scoped) ---
    stores_q = (
        select(Store.id, Store.name, func.count(CurrentPrice.id).label("count"))
        .join(CurrentPrice, CurrentPrice.store_id == Store.id)
        .join(ctx, CurrentPrice.product_id == ctx.c.pid)
        .where(Store.is_active.is_(True))
        .group_by(Store.id, Store.name)
        .order_by(func.count(CurrentPrice.id).desc())
    )
    stores_result = await db.execute(stores_q)
    stores = [{"id": r.id, "name": r.name, "count": r.count} for r in stores_result]

    # --- Categories (scoped) ---
    categories_q = (
        select(Product.category, func.count(Product.id).label("count"))
        .join(ctx, Product.id == ctx.c.pid)
        .where(Product.category.isnot(None))
        .group_by(Product.category)
        .order_by(func.count(Product.id).desc())
    )
    categories_result = await db.execute(categories_q)
    categories = [
        {"id": r.category, "name": r.category, "count": r.count}
        for r in categories_result
    ]

    # --- Price range (scoped) ---
    price_q = (
        select(
            func.min(CurrentPrice.price_azn).label("min_price"),
            func.max(CurrentPrice.price_azn).label("max_price"),
        )
        .join(ctx, CurrentPrice.product_id == ctx.c.pid)
        .where(CurrentPrice.in_stock.is_(True))
    )
    price_result = await db.execute(price_q)
    price_row = price_result.first()

    # --- Dynamic attributes (chip, size_mm) from JSONB ---
    attributes: dict[str, list[dict]] = {}

    # Chip values (for MacBooks)
    chip_expr = Product.attributes["chip"].astext
    chip_q = (
        select(
            chip_expr.label("chip"),
            func.count(Product.id).label("count"),
        )
        .join(ctx, Product.id == ctx.c.pid)
        .where(chip_expr.isnot(None))
        .where(chip_expr != "null")
        .group_by(chip_expr)
        .order_by(func.count(Product.id).desc())
    )
    chip_result = await db.execute(chip_q)
    chip_values = [
        {"id": r.chip, "name": r.chip, "count": r.count} for r in chip_result
    ]
    if chip_values:
        attributes["chip"] = chip_values

    # Size values (for watches)
    size_expr = Product.attributes["size_mm"].astext
    size_q = (
        select(
            size_expr.label("size_mm"),
            func.count(Product.id).label("count"),
        )
        .join(ctx, Product.id == ctx.c.pid)
        .where(size_expr.isnot(None))
        .where(size_expr != "null")
        .group_by(size_expr)
        .order_by(size_expr)
    )
    size_result = await db.execute(size_q)
    size_values = [
        {"id": r.size_mm, "name": f"{r.size_mm}mm", "count": r.count}
        for r in size_result
    ]
    if size_values:
        attributes["size_mm"] = size_values

    result = {
        "brands": brands,
        "stores": stores,
        "categories": categories,
        "price_range": {
            "min": (
                float(price_row.min_price) if price_row and price_row.min_price else 0
            ),
            "max": (
                float(price_row.max_price) if price_row and price_row.max_price else 0
            ),
        },
        "attributes": attributes,
    }

    await set_cache(cache_key, result, ttl=FILTERS_TTL)
    return result

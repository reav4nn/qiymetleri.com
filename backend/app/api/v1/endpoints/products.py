import math
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.product import (
    PaginatedResponse,
    PriceHistorySchema,
    ProductDetailSchema,
    ProductListSchema,
)
from app.services.product_service import (
    get_family_variants,
    get_price_history,
    get_product_by_id,
    get_products,
)

router = APIRouter()


@router.get("", response_model=PaginatedResponse)
async def list_products(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    q: str | None = Query(None, max_length=200),
    category: str | None = None,
    brand: str | None = None,
    store_id: str | None = None,
    min_price: float | None = Query(None, ge=0),
    max_price: float | None = Query(None, ge=0),
    sort_by: str = Query("name", pattern="^(name|price_asc|price_desc)$"),
    db: AsyncSession = Depends(get_db),
):
    items, total = await get_products(
        db,
        page=page,
        per_page=per_page,
        q=q,
        category=category,
        brand=brand,
        store_id=store_id,
        min_price=min_price,
        max_price=max_price,
        sort_by=sort_by,
    )
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.get("/{product_id}", response_model=ProductDetailSchema)
async def get_product(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    product = await get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Get all variants in the same family
    family_members = await get_family_variants(db, product)
    variants = []
    for v in family_members:
        attrs = v.attributes or {}
        variants.append({
            "id": v.id,
            "name": v.name,
            "storage_gb": attrs.get("storage_gb"),
            "color": attrs.get("color"),
            "current_prices": v.current_prices,
        })

    return {
        "id": product.id,
        "canonical_id": product.canonical_id,
        "brand": product.brand,
        "category": product.category,
        "model_family": product.model_family,
        "name": product.model_family or product.name,
        "image_url": product.image_url or next(
            (v.image_url for v in family_members if v.image_url), None
        ),
        "attributes": product.attributes,
        "current_prices": product.current_prices,
        "variants": variants,
        "created_at": product.created_at,
        "updated_at": product.updated_at,
    }


@router.get("/{product_id}/history", response_model=list[PriceHistorySchema])
async def get_product_price_history(
    product_id: UUID,
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    product = await get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return await get_price_history(db, product_id, days=days)

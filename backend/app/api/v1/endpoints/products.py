import math
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.product import (
    PaginatedResponse,
    ProductDetailSchema,
    ProductListSchema,
)
from app.services.product_service import get_product_by_id, get_products

router = APIRouter()


@router.get("", response_model=PaginatedResponse)
async def list_products(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
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
    return product

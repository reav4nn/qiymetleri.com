from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class StoreSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    base_url: str
    is_active: bool


class CurrentPriceSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    store_id: str
    price_azn: float
    original_title: str | None = None
    url: str | None = None
    in_stock: bool = True
    last_checked_at: datetime


class ProductListSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    canonical_id: str
    brand: str | None = None
    category: str | None = None
    model_family: str | None = None
    name: str
    lowest_price: float | None = None
    store_count: int = 0


class ProductDetailSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    canonical_id: str
    brand: str | None = None
    category: str | None = None
    model_family: str | None = None
    name: str
    attributes: dict | None = None
    current_prices: list[CurrentPriceSchema] = []
    created_at: datetime
    updated_at: datetime


class PriceHistorySchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    time: datetime
    product_id: UUID
    store_id: str
    price_azn: float
    in_stock: bool | None = None


class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    per_page: int
    pages: int

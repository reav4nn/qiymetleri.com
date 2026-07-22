from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class DashboardStats(BaseModel):
    total_products: int
    total_variants: int
    total_stores: int
    active_stores: int
    total_prices: int
    price_range_min: float | None
    price_range_max: float | None
    products_with_images: int
    last_price_update: datetime | None
    categories: list[dict]


class SpiderStatus(BaseModel):
    name: str
    display_name: str
    last_run: datetime | None
    last_status: str | None
    last_item_count: int | None
    last_duration: float | None
    schedule: str
    is_running: bool


class ScraperOverview(BaseModel):
    spiders: list[SpiderStatus]
    worker_online: bool
    active_tasks: int
    scheduled_tasks: int


class TaskResult(BaseModel):
    task_id: str
    spider: str
    status: str
    started_at: datetime | None
    completed_at: datetime | None
    item_count: int | None
    duration: float | None
    error: str | None


class StoreHealth(BaseModel):
    id: str
    name: str
    base_url: str
    is_active: bool
    product_count: int
    in_stock_count: int
    avg_price: float | None
    min_price: float | None
    max_price: float | None
    last_crawl: datetime | None
    last_price_update: datetime | None


class PriceAnomaly(BaseModel):
    product_id: str
    product_name: str
    store_id: str
    old_price: float
    new_price: float
    change_pct: float
    detected_at: datetime


class TriggerResponse(BaseModel):
    task_id: str
    spider: str
    status: str
    message: str


class RecentProduct(BaseModel):
    product_id: str
    name: str
    brand: str | None
    category: str | None
    image_url: str | None
    created_at: datetime | None
    price: float | None
    url: str | None
    in_stock: bool | None
    store_name: str
    store_id: str


class ProductModelCreate(BaseModel):
    category_id: str = Field(min_length=1, max_length=100, pattern=r"^[a-z0-9_-]+$")
    brand: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=300)
    status: Literal["provisional", "verified"] = "provisional"
    reason: str = Field(min_length=3, max_length=2000)


class ModelMappingResolution(BaseModel):
    action: Literal["assign", "reject"]
    target_model_id: UUID | None = None
    reason: str = Field(min_length=3, max_length=2000)

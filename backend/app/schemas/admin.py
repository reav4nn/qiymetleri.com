from datetime import datetime

from pydantic import BaseModel


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

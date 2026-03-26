from fastapi import APIRouter

from app.api.v1.endpoints import admin, filters, products, search

api_router = APIRouter()

api_router.include_router(products.router, prefix="/products", tags=["products"])
api_router.include_router(search.router, prefix="/search", tags=["search"])
api_router.include_router(filters.router, prefix="/filters", tags=["filters"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])

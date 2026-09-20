from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.cache import redis_client
from app.core.database import engine

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health")
@app.get("/health/live")
async def liveness_check():
    return {"status": "ok"}


async def database_ready() -> None:
    async with engine.connect() as connection:
        await connection.execute(text("SELECT 1"))


async def cache_ready() -> None:
    await redis_client.ping()


@app.get("/health/ready")
async def readiness_check():
    checks = {"database": "ok", "cache": "ok"}

    try:
        await database_ready()
    except Exception:
        checks["database"] = "error"

    try:
        await cache_ready()
    except Exception:
        checks["cache"] = "error"

    if "error" in checks.values():
        raise HTTPException(
            status_code=503,
            detail={"status": "not_ready", "checks": checks},
        )

    return {"status": "ready", "checks": checks}

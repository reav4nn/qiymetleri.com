import json
import logging
from typing import Any

import redis.asyncio as redis

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

redis_client = redis.from_url(settings.CACHE_REDIS_URL, decode_responses=True)


async def get_cache(key: str) -> Any | None:
    try:
        data = await redis_client.get(key)
        if data:
            return json.loads(data)
    except Exception as exc:
        logger.debug("Redis get_cache error: %s", exc)
    return None


async def set_cache(key: str, value: Any, ttl: int = 300) -> None:
    try:
        await redis_client.set(key, json.dumps(value, default=str), ex=ttl)
    except Exception as exc:
        logger.debug("Redis set_cache error: %s", exc)


async def invalidate_cache(pattern: str) -> None:
    try:
        async for key in redis_client.scan_iter(match=pattern):
            await redis_client.delete(key)
    except Exception as exc:
        logger.debug("Redis invalidate_cache error: %s", exc)

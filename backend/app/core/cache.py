import json
from typing import Any

import redis.asyncio as redis

from app.core.config import get_settings

settings = get_settings()

redis_client = redis.from_url(settings.CACHE_REDIS_URL, decode_responses=True)


async def get_cache(key: str) -> Any | None:
    data = await redis_client.get(key)
    if data:
        return json.loads(data)
    return None


async def set_cache(key: str, value: Any, ttl: int = 300) -> None:
    await redis_client.set(key, json.dumps(value, default=str), ex=ttl)


async def invalidate_cache(pattern: str) -> None:
    async for key in redis_client.scan_iter(match=pattern):
        await redis_client.delete(key)

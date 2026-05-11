import json
import time
import fnmatch
from typing import Any, Optional
import logging

try:
    from redis import asyncio as aioredis
    REDIS_AVAILABLE = True
except ImportError:
    try:
        import aioredis  # older standalone package
        REDIS_AVAILABLE = True
    except ImportError:
        REDIS_AVAILABLE = False
        aioredis = None

from app.core.config import settings

logger = logging.getLogger(__name__)


class CacheService:
    """
    Cache service with Redis support and in-memory fallback.
    Equivalent to NestJS CacheService.
    """

    def __init__(self):
        self.redis_disabled = settings.redis_disabled
        self.use_redis = (
            REDIS_AVAILABLE
            and not self.redis_disabled
            and bool(settings.redis_url)
            and settings.redis_url.strip()
        )

        if self.use_redis:
            try:
                self.redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
                logger.info("Redis cache enabled (async)")
            except Exception as e:
                logger.warning(f"Failed to initialise Redis client: {e}. Falling back to in-memory cache.")
                self.use_redis = False
                self.redis_client = None
        else:
            self.redis_client = None

        # In-memory cache fallback
        self._memory_cache: dict[str, tuple[Any, float]] = {}  # key -> (value, expiry_timestamp)

    def _is_expired(self, expiry: float) -> bool:
        return time.time() >= expiry

    def _clean_memory_cache(self):
        """Remove expired entries from in-memory cache."""
        # Snapshot items() before iterating to avoid RuntimeError on concurrent mutation
        expired_keys = [k for k, (_, exp) in list(self._memory_cache.items()) if self._is_expired(exp)]
        for k in expired_keys:
            self._memory_cache.pop(k, None)

    async def get(self, key: str) -> Optional[Any]:
        if self.use_redis:
            try:
                value = await self.redis_client.get(key)
                if value is not None:
                    return json.loads(value)
                return None
            except Exception as e:
                logger.warning(f"Redis get error for key {key}: {e}. Falling back to memory.")
                # Fall through to memory cache on error

        # In-memory cache
        self._clean_memory_cache()
        if key in self._memory_cache:
            value, expiry = self._memory_cache[key]
            if not self._is_expired(expiry):
                return value
            else:
                del self._memory_cache[key]
        return None

    async def set(self, key: str, value: Any, ttl_seconds: int = 3600) -> bool:
        """Set a cache value. Returns True if successful."""
        expiry = time.time() + ttl_seconds
        if self.use_redis:
            try:
                await self.redis_client.setex(key, ttl_seconds, json.dumps(value))
                return True
            except Exception as e:
                logger.warning(f"Redis set error for key {key}: {e}. Falling back to memory.")
                # Fall through to memory cache on error

        # In-memory cache
        self._memory_cache[key] = (value, expiry)
        # Optional: clean up if cache gets too large (simple size limit)
        if len(self._memory_cache) > 1000:
            self._clean_memory_cache()
        return True

    async def delete(self, key: str) -> bool:
        """Delete a cache key. Returns True if successful."""
        result = False
        if self.use_redis:
            try:
                await self.redis_client.delete(key)
                result = True
            except Exception as e:
                logger.warning(f"Redis delete error for key {key}: {e}")
        # Also delete from memory cache if present
        if key in self._memory_cache:
            del self._memory_cache[key]
            result = True
        return result

    async def clear(self) -> None:
        """Clear all cache."""
        if self.use_redis:
            try:
                await self.redis_client.flushdb()
            except Exception as e:
                logger.warning(f"Redis clear error: {e}")
        self._memory_cache.clear()

    async def exists(self, key: str) -> bool:
        """Check if a key exists in cache."""
        if self.use_redis:
            try:
                return await self.redis_client.exists(key) == 1
            except Exception as e:
                logger.warning(f"Redis exists error for key {key}: {e}")
                # Fall through to memory cache

        self._clean_memory_cache()
        return key in self._memory_cache

    async def invalidate_pattern(self, pattern: str) -> int:
        """
        Invalidate all keys matching a pattern (e.g. "cv:analysis:*").
        Returns number of removed keys.
        """
        removed = 0

        if self.use_redis:
            try:
                keys = [k async for k in self.redis_client.scan_iter(match=pattern)]
                if keys:
                    removed += int(await self.redis_client.delete(*keys))
            except Exception as e:
                logger.warning(f"Redis invalidate_pattern error for pattern {pattern}: {e}")

        # In-memory fallback / dual cleanup
        try:
            for key in list(self._memory_cache.keys()):
                if fnmatch.fnmatch(key, pattern):
                    del self._memory_cache[key]
                    removed += 1
        except Exception as e:
            logger.warning(f"Memory invalidate_pattern error for pattern {pattern}: {e}")

        return removed
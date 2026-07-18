import logging
import json
import os
import re
from datetime import datetime, timezone

import redis
from itemadapter import ItemAdapter
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

logger = logging.getLogger(__name__)

try:
    from shared.normalizer import normalize_name
except ImportError:
    normalize_name = None
    logger.warning("Could not import normalize_name — products won't be auto-normalized")


class DatabasePipeline:
    """Store scraped items in PostgreSQL."""

    def __init__(self, database_url: str, redis_url: str):
        self.database_url = database_url
        self.redis_url = redis_url
        self.engine = None
        self.session_factory = None
        self._redis = None
        self._invalidated_keys: set[str] = set()

    @classmethod
    def from_crawler(cls, crawler):
        return cls(
            database_url=crawler.settings.get("DATABASE_URL"),
            redis_url=crawler.settings.get(
                "REDIS_URL",
                os.getenv("REDIS_URL", "redis://redis:6379/0"),
            ),
        )

    def open_spider(self, spider):
        self.engine = create_engine(self.database_url)
        self.session_factory = sessionmaker(bind=self.engine)
        self._spider_name = spider.name
        self._run_start = datetime.now(timezone.utc)
        self._item_count = 0
        self._error_count = 0
        try:
            self._redis = redis.from_url(self.redis_url, decode_responses=True)
            self._redis.ping()
            logger.info("Redis connected for cache invalidation")
        except Exception as e:
            logger.warning(f"Redis not available — cache won't be invalidated: {e}")
            self._redis = None

    def close_spider(self, spider):
        # Record scraper run result
        run_end = datetime.now(timezone.utc)
        duration_s = (run_end - self._run_start).total_seconds()
        status = "success" if self._error_count == 0 else "partial"
        if self._item_count == 0:
            status = "failed"

        try:
            with self.session_factory() as session:
                session.execute(
                    text("""
                        INSERT INTO scraper_runs (spider, status, items_scraped, errors, duration_seconds, started_at, finished_at)
                        VALUES (:spider, :status, :items, :errors, :duration, :started, :finished)
                    """),
                    {
                        "spider": self._spider_name,
                        "status": status,
                        "items": self._item_count,
                        "errors": self._error_count,
                        "duration": duration_s,
                        "started": self._run_start,
                        "finished": run_end,
                    },
                )
                session.commit()
            logger.info(
                f"Scraper run recorded: {self._spider_name} — {status}, "
                f"{self._item_count} items, {self._error_count} errors, {duration_s:.1f}s"
            )
        except Exception as e:
            logger.warning(f"Failed to record scraper run: {e}")

        # Batch-invalidate broad cache patterns once per spider run
        if self._redis and self._invalidated_keys:
            try:
                for pattern in ["filters:*", "products:list:*"]:
                    cursor = 0
                    while True:
                        cursor, keys = self._redis.scan(cursor, match=pattern, count=200)
                        if keys:
                            self._redis.delete(*keys)
                        if cursor == 0:
                            break
                logger.info(
                    f"Cache invalidated: {len(self._invalidated_keys)} product keys "
                    f"+ filters + product lists"
                )
            except Exception as e:
                logger.warning(f"Cache invalidation failed: {e}")
        if self.engine:
            self.engine.dispose()

    def process_item(self, item, spider):
        adapter = ItemAdapter(item)
        price_azn = adapter.get("price_azn")
        if price_azn is None:
            logger.warning(f"Skipping item with no price: {adapter.get('url')}")
            self._error_count += 1
            return item

        now = datetime.now(timezone.utc)

        try:
            with self.session_factory() as session:
                canonical_id = self._build_canonical_id(adapter)
                self._ensure_product_exists(session, adapter, canonical_id)
                self._upsert_current_price(session, adapter, canonical_id, now)
                self._insert_price_history(session, adapter, canonical_id, now)
                session.commit()

            self._item_count += 1

            # Invalidate product-specific cache keys
            if self._redis:
                try:
                    product_key = f"product:{canonical_id}"
                    self._redis.delete(product_key)
                    self._invalidated_keys.add(product_key)
                except Exception:
                    pass
        except Exception as e:
            self._error_count += 1
            logger.error(f"Failed to process item {adapter.get('url')}: {e}")

        return item

    def _ensure_product_exists(
        self, session: Session, adapter: ItemAdapter, canonical_id: str
    ):
        """Create the product if it doesn't exist, or update image_url if missing."""
        result = session.execute(
            text("SELECT id, image_url FROM products WHERE canonical_id = :canonical_id"),
            {"canonical_id": canonical_id},
        )
        row = result.fetchone()
        image_url = self._clean_image_url(adapter.get("image_url"))

        if row:
            if image_url and not row[1]:
                session.execute(
                    text("UPDATE products SET image_url = :image_url WHERE id = :pid"),
                    {"image_url": image_url, "pid": str(row[0])},
                )
            return

        # Normalize product name to extract model_family and attributes
        name = adapter.get("original_title", "")
        model_family = None
        attributes = {}
        if normalize_name:
            parsed = normalize_name(name)
            model_family = parsed.get("model_family")
            for key in ("storage_gb", "ram_gb", "color", "sku"):
                if parsed.get(key):
                    attributes[key] = parsed[key]

        session.execute(
            text("""
                INSERT INTO products (id, canonical_id, brand, category, name, image_url, model_family, attributes)
                VALUES (gen_random_uuid(), :canonical_id, :brand, :category, :name, :image_url, :model_family, CAST(:attributes AS jsonb))
                ON CONFLICT (canonical_id) DO NOTHING
            """),
            {
                "canonical_id": canonical_id,
                "brand": adapter.get("brand"),
                "category": adapter.get("category"),
                "name": name,
                "image_url": image_url,
                "model_family": model_family,
                "attributes": json.dumps(attributes),
            },
        )
        logger.info(f"Created new product: {canonical_id} (family={model_family})")

    @staticmethod
    def _clean_image_url(url: str | None) -> str | None:
        """Filter out placeholder/invalid image URLs."""
        if not url:
            return None
        if url.startswith("data:"):
            return None
        if len(url) < 10:
            return None
        return url

    def _upsert_current_price(
        self, session: Session, adapter: ItemAdapter, canonical_id: str, now: datetime
    ):
        session.execute(
            text("""
                INSERT INTO current_prices (id, product_id, store_id, price_azn, original_title, url, in_stock, last_checked_at)
                SELECT
                    gen_random_uuid(),
                    p.id,
                    :store_id,
                    :price_azn,
                    :original_title,
                    :url,
                    :in_stock,
                    :now
                FROM products p
                WHERE p.canonical_id = :canonical_id
                ON CONFLICT (product_id, store_id)
                DO UPDATE SET
                    price_azn = EXCLUDED.price_azn,
                    original_title = EXCLUDED.original_title,
                    url = EXCLUDED.url,
                    in_stock = EXCLUDED.in_stock,
                    last_checked_at = EXCLUDED.last_checked_at
            """),
            {
                "store_id": adapter.get("store_id"),
                "price_azn": adapter.get("price_azn"),
                "original_title": adapter.get("original_title"),
                "url": adapter.get("url"),
                "in_stock": adapter.get("in_stock", True),
                "canonical_id": canonical_id,
                "now": now,
            },
        )

    def _insert_price_history(
        self, session: Session, adapter: ItemAdapter, canonical_id: str, now: datetime
    ):
        session.execute(
            text("""
                INSERT INTO price_history (time, product_id, store_id, price_azn, in_stock)
                SELECT
                    :now,
                    p.id,
                    :store_id,
                    :price_azn,
                    :in_stock
                FROM products p
                WHERE p.canonical_id = :canonical_id
            """),
            {
                "now": now,
                "store_id": adapter.get("store_id"),
                "price_azn": adapter.get("price_azn"),
                "in_stock": adapter.get("in_stock", True),
                "canonical_id": canonical_id,
            },
        )

    @staticmethod
    def _build_canonical_id(adapter: ItemAdapter) -> str:
        """Build a canonical ID using normalized attributes when available.

        Uses model_family + storage + color for a more precise ID that
        distinguishes variants while grouping cross-store duplicates.
        Falls back to brand + title slug for unrecognized products.
        """
        brand = (adapter.get("brand") or "unknown").lower().strip()
        title = adapter.get("original_title") or ""

        if normalize_name:
            parsed = normalize_name(title)
            family = parsed.get("model_family")
            if family:
                parts = [brand, family.lower()]
                if parsed.get("storage_gb"):
                    parts.append(f"{parsed['storage_gb']}gb")
                if parsed.get("color"):
                    parts.append(parsed["color"].lower())
                slug = re.sub(r"[^a-z0-9]+", "_", "_".join(parts)).strip("_")
                return slug[:255]

        # Fallback: simple brand + title slug
        slug = re.sub(r"[^a-z0-9]+", "_", f"{brand}_{title}".lower()).strip("_")
        return slug[:255]

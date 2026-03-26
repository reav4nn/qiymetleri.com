import logging
import json
import re
from datetime import datetime, timezone

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

    def __init__(self, database_url: str):
        self.database_url = database_url
        self.engine = None
        self.session_factory = None

    @classmethod
    def from_crawler(cls, crawler):
        return cls(
            database_url=crawler.settings.get("DATABASE_URL"),
        )

    def open_spider(self, spider):
        self.engine = create_engine(self.database_url)
        self.session_factory = sessionmaker(bind=self.engine)
        self._ensure_schema()

    def close_spider(self, spider):
        if self.engine:
            self.engine.dispose()

    def _ensure_schema(self):
        """Create required tables and seed data if they don't exist."""
        with self.engine.begin() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS stores (
                    id VARCHAR(100) PRIMARY KEY,
                    name VARCHAR(200) NOT NULL,
                    base_url TEXT NOT NULL,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS products (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    canonical_id VARCHAR(255) UNIQUE NOT NULL,
                    brand VARCHAR(100),
                    category VARCHAR(100),
                    model_family VARCHAR(200),
                    name VARCHAR(500) NOT NULL,
                    image_url TEXT,
                    attributes JSONB DEFAULT '{}',
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS current_prices (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                    store_id VARCHAR(100) NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
                    price_azn DECIMAL(10,2) NOT NULL,
                    original_title TEXT,
                    url TEXT,
                    in_stock BOOLEAN DEFAULT TRUE,
                    last_checked_at TIMESTAMPTZ DEFAULT NOW(),
                    CONSTRAINT uq_product_store UNIQUE (product_id, store_id)
                )
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS price_history (
                    time TIMESTAMPTZ NOT NULL,
                    product_id UUID NOT NULL,
                    store_id VARCHAR(100) NOT NULL,
                    price_azn DECIMAL(10,2) NOT NULL,
                    in_stock BOOLEAN
                )
            """))
            # Seed stores
            conn.execute(text("""
                INSERT INTO stores (id, name, base_url) VALUES
                    ('kontakt_home', 'Kontakt Home', 'https://kontakt.az'),
                    ('baku_electronics', 'Baku Electronics', 'https://bakuelectronics.az'),
                    ('irshad_electronics', 'Irshad Electronics', 'https://irshad.az'),
                    ('ispace', 'iSpace', 'https://ispace.az')
                ON CONFLICT (id) DO NOTHING
            """))
        logger.info("Database schema verified/created")

    def process_item(self, item, spider):
        adapter = ItemAdapter(item)
        price_azn = adapter.get("price_azn")
        if price_azn is None:
            logger.warning(f"Skipping item with no price: {adapter.get('url')}")
            return item

        now = datetime.now(timezone.utc)

        with self.session_factory() as session:
            canonical_id = self._build_canonical_id(adapter)
            self._ensure_product_exists(session, adapter, canonical_id)
            self._upsert_current_price(session, adapter, canonical_id, now)
            self._insert_price_history(session, adapter, canonical_id, now)
            session.commit()

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
        brand = (adapter.get("brand") or "unknown").lower().strip()
        title = (adapter.get("original_title") or "").lower().strip()
        # Simple canonical ID — will be improved with normalization pipeline
        slug = re.sub(r"[^a-z0-9]+", "_", f"{brand}_{title}").strip("_")
        return slug[:255]

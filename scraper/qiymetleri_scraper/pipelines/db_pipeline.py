import logging
import re
from datetime import datetime, timezone

from itemadapter import ItemAdapter
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

logger = logging.getLogger(__name__)


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

    def close_spider(self, spider):
        if self.engine:
            self.engine.dispose()

    def process_item(self, item, spider):
        adapter = ItemAdapter(item)
        price_azn = adapter.get("price_azn")
        if price_azn is None:
            logger.warning(f"Skipping item with no price: {adapter.get('url')}")
            return item

        now = datetime.now(timezone.utc)

        with self.session_factory() as session:
            self._upsert_current_price(session, adapter, now)
            self._insert_price_history(session, adapter, now)
            session.commit()

        return item

    def _upsert_current_price(
        self, session: Session, adapter: ItemAdapter, now: datetime
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
                "canonical_id": self._build_canonical_id(adapter),
                "now": now,
            },
        )

    def _insert_price_history(
        self, session: Session, adapter: ItemAdapter, now: datetime
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
                "canonical_id": self._build_canonical_id(adapter),
            },
        )

    @staticmethod
    def _build_canonical_id(adapter: ItemAdapter) -> str:
        brand = (adapter.get("brand") or "unknown").lower().strip()
        title = (adapter.get("original_title") or "").lower().strip()
        # Simple canonical ID — will be improved with normalization pipeline
        slug = re.sub(r"[^a-z0-9]+", "_", f"{brand}_{title}").strip("_")
        return slug[:255]

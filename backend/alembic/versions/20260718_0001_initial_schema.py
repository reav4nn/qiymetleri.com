"""Create the initial application schema.

Revision ID: 20260718_0001
Revises:
Create Date: 2026-07-18
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260718_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute("""
        DO $$
        BEGIN
            CREATE EXTENSION IF NOT EXISTS timescaledb;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'TimescaleDB is unavailable; using standard PostgreSQL.';
        END;
        $$;
        """)

    op.create_table(
        "stores",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("base_url", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_table(
        "products",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("canonical_id", sa.String(length=255), nullable=False, unique=True),
        sa.Column("brand", sa.String(length=100)),
        sa.Column("category", sa.String(length=100)),
        sa.Column("model_family", sa.String(length=200)),
        sa.Column("name", sa.String(length=500), nullable=False),
        sa.Column(
            "attributes",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("image_url", sa.Text()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.execute("""
        ALTER TABLE products ADD COLUMN search_vector tsvector
        GENERATED ALWAYS AS (
            setweight(to_tsvector('simple', coalesce(brand, '')), 'A') ||
            setweight(to_tsvector('simple', coalesce(name, '')), 'B') ||
            setweight(to_tsvector('simple', coalesce(model_family, '')), 'C')
        ) STORED
        """)
    op.create_index("idx_products_brand", "products", ["brand"])
    op.create_index("idx_products_category", "products", ["category"])
    op.create_index("idx_products_canonical_id", "products", ["canonical_id"])
    op.create_index("idx_products_model_family", "products", ["model_family"])
    op.execute(
        "CREATE INDEX idx_products_name_trgm ON products USING gin (name gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX idx_products_model_family_trgm "
        "ON products USING gin (model_family gin_trgm_ops)"
    )
    op.execute("CREATE INDEX idx_products_search ON products USING gin (search_vector)")

    op.create_table(
        "current_prices",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("store_id", sa.String(length=100), nullable=False),
        sa.Column("price_azn", sa.Numeric(10, 2), nullable=False),
        sa.Column("original_title", sa.Text()),
        sa.Column("url", sa.Text()),
        sa.Column("in_stock", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "last_checked_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("product_id", "store_id", name="uq_product_store"),
    )
    op.create_index("idx_current_prices_product", "current_prices", ["product_id"])
    op.create_index("idx_current_prices_store", "current_prices", ["store_id"])
    op.create_index("idx_current_prices_price", "current_prices", ["price_azn"])

    op.create_table(
        "price_history",
        sa.Column("time", sa.DateTime(timezone=True), primary_key=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("store_id", sa.String(length=100), primary_key=True),
        sa.Column("price_azn", sa.Numeric(10, 2), nullable=False),
        sa.Column("in_stock", sa.Boolean()),
    )
    op.create_index(
        "idx_price_history_product", "price_history", ["product_id", "time"]
    )
    op.create_index("idx_price_history_store", "price_history", ["store_id", "time"])
    op.execute("""
        DO $$
        BEGIN
            PERFORM create_hypertable(
                'price_history', 'time', chunk_time_interval => INTERVAL '7 days',
                if_not_exists => TRUE
            );
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'price_history remains a standard PostgreSQL table.';
        END;
        $$;
        """)

    op.create_table(
        "product_matches",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("family_a", sa.String(length=200), nullable=False),
        sa.Column("family_b", sa.String(length=200), nullable=False),
        sa.Column("brand", sa.String(length=100)),
        sa.Column("similarity", sa.Numeric(5, 4), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column("merged_family", sa.String(length=200)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("family_a", "family_b", name="uq_product_match_families"),
    )
    op.create_index("idx_product_matches_status", "product_matches", ["status"])

    op.create_table(
        "scraper_runs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("spider", sa.String(length=100), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default=sa.text("'running'"),
        ),
        sa.Column(
            "items_scraped", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column("errors", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("duration_seconds", sa.Float()),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
    )
    op.create_index("idx_scraper_runs_spider", "scraper_runs", ["spider", "started_at"])

    op.execute("""
        INSERT INTO stores (id, name, base_url) VALUES
            ('kontakt_home', 'Kontakt Home', 'https://kontakt.az'),
            ('baku_electronics', 'Baku Electronics', 'https://bakuelectronics.az'),
            ('irshad_electronics', 'Irshad Electronics', 'https://irshad.az'),
            ('ispace', 'iSpace', 'https://ispace.az')
        """)
    op.execute("""
        CREATE VIEW v_product_lowest_price AS
        SELECT p.id, p.canonical_id, p.brand, p.category, p.name,
               MIN(cp.price_azn) AS lowest_price,
               COUNT(cp.id) AS store_count,
               (SELECT cp2.store_id FROM current_prices cp2
                WHERE cp2.product_id = p.id AND cp2.in_stock = TRUE
                ORDER BY cp2.price_azn ASC LIMIT 1) AS cheapest_store
        FROM products p
        LEFT JOIN current_prices cp
          ON cp.product_id = p.id AND cp.in_stock = TRUE
        GROUP BY p.id
        """)


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS v_product_lowest_price")
    op.drop_table("scraper_runs")
    op.drop_table("product_matches")
    op.drop_table("price_history")
    op.drop_table("current_prices")
    op.drop_table("products")
    op.drop_table("stores")

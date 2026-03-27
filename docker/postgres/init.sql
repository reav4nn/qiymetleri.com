-- qiymetleri.com PostgreSQL Schema
-- TimescaleDB extension for price_history hypertable

-- Enable TimescaleDB
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Enable trigram extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- STORES — Registered electronics stores in Azerbaijan
-- ============================================================
CREATE TABLE IF NOT EXISTS stores (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    base_url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRODUCTS — Canonical product entities
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_id VARCHAR(255) UNIQUE NOT NULL,
    brand VARCHAR(100),
    category VARCHAR(100),
    model_family VARCHAR(200),
    name VARCHAR(500) NOT NULL,
    attributes JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_brand ON products (brand);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);
CREATE INDEX IF NOT EXISTS idx_products_canonical_id ON products (canonical_id);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_model_family ON products (model_family);
CREATE INDEX IF NOT EXISTS idx_products_model_family_trgm ON products USING gin (model_family gin_trgm_ops);

-- Full-text search index
ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', coalesce(brand, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(name, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(model_family, '')), 'C')
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_products_search ON products USING gin (search_vector);

-- ============================================================
-- CURRENT_PRICES — Denormalized table for fast reads
-- ============================================================
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
);

CREATE INDEX IF NOT EXISTS idx_current_prices_product ON current_prices (product_id);
CREATE INDEX IF NOT EXISTS idx_current_prices_store ON current_prices (store_id);
CREATE INDEX IF NOT EXISTS idx_current_prices_price ON current_prices (price_azn);

-- ============================================================
-- PRICE_HISTORY — TimescaleDB hypertable for time-series data
-- ============================================================
CREATE TABLE IF NOT EXISTS price_history (
    time TIMESTAMPTZ NOT NULL,
    product_id UUID NOT NULL,
    store_id VARCHAR(100) NOT NULL,
    price_azn DECIMAL(10,2) NOT NULL,
    in_stock BOOLEAN
);

-- Convert to hypertable (7-day chunks)
SELECT create_hypertable('price_history', 'time',
    chunk_time_interval => INTERVAL '7 days',
    if_not_exists => TRUE
);

CREATE INDEX IF NOT EXISTS idx_price_history_product ON price_history (product_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_store ON price_history (store_id, time DESC);

-- ============================================================
-- SEED DATA — Pilot stores
-- ============================================================
INSERT INTO stores (id, name, base_url) VALUES
    ('kontakt_home', 'Kontakt Home', 'https://kontakt.az'),
    ('baku_electronics', 'Baku Electronics', 'https://bakuelectronics.az'),
    ('irshad_electronics', 'Irshad Electronics', 'https://irshad.az'),
    ('ispace', 'iSpace', 'https://ispace.az')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- PRODUCT_MATCHES — Cross-store fuzzy match tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS product_matches (
    id SERIAL PRIMARY KEY,
    family_a VARCHAR(200) NOT NULL,
    family_b VARCHAR(200) NOT NULL,
    brand VARCHAR(100),
    similarity DECIMAL(5,4) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    merged_family VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    UNIQUE(family_a, family_b)
);

CREATE INDEX IF NOT EXISTS idx_product_matches_status ON product_matches (status);

-- ============================================================
-- SCRAPER_RUNS — Scraper job history for health monitoring
-- ============================================================
CREATE TABLE IF NOT EXISTS scraper_runs (
    id SERIAL PRIMARY KEY,
    spider VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'running',
    items_scraped INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    duration_seconds REAL,
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_scraper_runs_spider ON scraper_runs (spider, started_at DESC);

-- ============================================================
-- USEFUL VIEWS
-- ============================================================

-- Product with lowest price view
CREATE OR REPLACE VIEW v_product_lowest_price AS
SELECT
    p.id,
    p.canonical_id,
    p.brand,
    p.category,
    p.name,
    MIN(cp.price_azn) AS lowest_price,
    COUNT(cp.id) AS store_count,
    (SELECT cp2.store_id FROM current_prices cp2
     WHERE cp2.product_id = p.id AND cp2.in_stock = TRUE
     ORDER BY cp2.price_azn ASC LIMIT 1) AS cheapest_store
FROM products p
LEFT JOIN current_prices cp ON cp.product_id = p.id AND cp.in_stock = TRUE
GROUP BY p.id;

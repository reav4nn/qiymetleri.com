"""Fix iSpace in-stock statuses based on live availability audit.

Revision ID: 20260922_0003
Revises: 20260719_0002
Create Date: 2026-09-22
"""

from alembic import op
import sqlalchemy as sa

revision = "20260922_0003"
down_revision = "20260719_0002"
branch_labels = None
depends_on = None

IN_STOCK_ISPACE_URLS = [
    "https://ispace.az/product/airpods-max-2-blue-mhwm4ze-a",
    "https://ispace.az/product/airpods-max-2-midnight-mhwk4ze-a",
    "https://ispace.az/product/airpods-max-2-orange-mhwn4ze-a",
    "https://ispace.az/product/airpods-max-2-purple-mhwp4ze-a",
    "https://ispace.az/product/airpods-max-2-starlight-mhwl4ze-a",
    "https://ispace.az/product/airpods-max-mww73ze-a",
    "https://ispace.az/product/airpods-max-mww83ze-a",
    "https://ispace.az/product/airpods-pro-3-mfhp4ze-a",
    "https://ispace.az/product/apple-watch-series-11-gps-purple-fog-sport-band-ml-46mm-silver-aluminium-meva4rk-a",
    "https://ispace.az/product/apple-watch-ultra-3-anchor-blue-ocean-band-49mm-natural-mewh4qi-a",
    "https://ispace.az/product/apple-watch-ultra-3-black-ocean-band-49mm-black-mf0j4qi-a",
    "https://ispace.az/product/apple-watch-ultra-3-light-blue-alpine-loop-medium-49mm-natural-mewm4qi-a",
    "https://ispace.az/product/apple-watch-ultra-3-natural-titanium-milanese-loop-medium-49mm-natural-mewy4qi-a",
    "https://ispace.az/product/imac-24-m4-10c-cpu-10c-gpu-24gb-512gb-ssd-silver-mcr24ru-a",
    "https://ispace.az/product/iphone-17-pro-256-gb-cosmic-orange-mg8h4zd-a",
    "https://ispace.az/product/iphone-17-pro-256-gb-silver-mg8g4zd-a",
    "https://ispace.az/product/iphone-17-pro-max-256-gb-cosmic-orange-mfyn4af-a",
    "https://ispace.az/product/iphone-17-pro-max-256-gb-deep-blue-mfyp4af-a",
    "https://ispace.az/product/iphone-17-pro-max-256-gb-silver-mfym4hx-a",
    "https://ispace.az/product/macbook-air-136-m5-10c-cpu10c-gpu-24-gb-1-tb-midnight-z1l8001mw",
    "https://ispace.az/product/macbook-air-153-m5-10c-cpu10c-gpu-16-gb-1-tb-midnight-z1lx000zx",
    "https://ispace.az/product/macbook-air-153-m5-10c-cpu10c-gpu-16-gb-1-tb-silver-z1lr000ye",
    "https://ispace.az/product/macbook-air-153-m5-10c-cpu10c-gpu-16-gb-1-tb-sky-blue-mdvt4ru-a",
    "https://ispace.az/product/macbook-air-153-m5-10c-cpu10c-gpu-16-gb-1-tb-starlight-mdve4ru-a",
    "https://ispace.az/product/macbook-neo-13-a18-pro-6c-cpu5c-gpu-8-gb-256-gb-citrus-mhfd4ru-a",
    "https://ispace.az/product/macbook-neo-13-a18-pro-6c-cpu5c-gpu-8-gb-256-gb-indigo-mhff4ru-a",
    "https://ispace.az/product/macbook-neo-13-a18-pro-6c-cpu5c-gpu-8-gb-512-gb-citrus-mhfe4ru-a",
    "https://ispace.az/product/macbook-neo-13-a18-pro-6c-cpu5c-gpu-8-gb-512-gb-indigo-mhfg4ru-a",
    "https://ispace.az/product/macbook-pro-142-m5-10c-cpu10c-gpu-16-gb-1-tb-silver-z1km000d1",
    "https://ispace.az/product/macbook-pro-142-m5-10c-cpu10c-gpu-32-gb-1-tb-space-black-mj3d4ru-a",
    "https://ispace.az/product/macbook-pro-142-m5-pro-15c-cpu16c-gpu-24-gb-1-tb-silver-z1mh0029m",
    "https://ispace.az/product/macbook-pro-142-m5-pro-15c-cpu16c-gpu-24-gb-1-tb-space-black-z1ml002bv",
    "https://ispace.az/product/macbook-pro-162-m5-pro-18c-cpu20c-gpu-48-gb-1-tb-silver-z1mw000p9",
    "https://ispace.az/product/macbook-pro-162-m5-pro-18c-cpu20c-gpu-48-gb-1-tb-space-black-z1n0000p8",
    "https://ispace.az/product/tws-bluetooth-headsets-apple-airpods-gen-4-mxp63zea",
    "https://ispace.az/product/tws-bluetooth-headsets-apple-airpods-gen-4-mxp93zea",
]


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Update in_stock = TRUE for live verified items
    conn.execute(
        sa.text("""
            UPDATE current_prices
            SET in_stock = TRUE, last_checked_at = NOW()
            WHERE store_id = 'ispace' AND url = ANY(:urls)
        """),
        {"urls": IN_STOCK_ISPACE_URLS},
    )

    # 2. Record new entry in price_history
    conn.execute(
        sa.text("""
            INSERT INTO price_history (time, product_id, store_id, price_azn, in_stock)
            SELECT NOW(), cp.product_id, cp.store_id, cp.price_azn, TRUE
            FROM current_prices cp
            WHERE cp.store_id = 'ispace' AND cp.url = ANY(:urls)
            ON CONFLICT (time, product_id, store_id) DO UPDATE SET in_stock = TRUE
        """),
        {"urls": IN_STOCK_ISPACE_URLS},
    )


def downgrade() -> None:
    pass

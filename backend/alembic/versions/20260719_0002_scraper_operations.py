"""Add managed scraper schedules and durable run telemetry.

Revision ID: 20260719_0002
Revises: 20260718_0001
Create Date: 2026-07-19
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260719_0002"
down_revision = "20260718_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("scraper_runs", sa.Column("task_id", sa.String(100), unique=True))
    op.add_column("scraper_runs", sa.Column("trigger", sa.String(20), nullable=False, server_default="manual"))
    op.add_column("scraper_runs", sa.Column("attempt", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("scraper_runs", sa.Column("items_seen", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("scraper_runs", sa.Column("items_saved", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("scraper_runs", sa.Column("items_dropped", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("scraper_runs", sa.Column("error_message", sa.Text()))
    op.add_column("scraper_runs", sa.Column("log_tail", sa.Text()))
    op.create_index("idx_scraper_runs_status", "scraper_runs", ["status", "started_at"])

    op.create_table(
        "scraper_configs",
        sa.Column("spider", sa.String(100), primary_key=True),
        sa.Column("store_id", sa.String(100), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("display_name", sa.String(200), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("schedule_type", sa.String(20), nullable=False, server_default="interval"),
        sa.Column("interval_minutes", sa.Integer()),
        sa.Column("cron_expression", sa.String(100)),
        sa.Column("timezone", sa.String(50), nullable=False, server_default="Asia/Baku"),
        sa.Column("next_run_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.CheckConstraint("schedule_type IN ('interval', 'cron')", name="ck_scraper_schedule_type"),
    )
    op.create_index("idx_scraper_configs_due", "scraper_configs", ["is_enabled", "next_run_at"])

    op.create_table(
        "scraper_run_categories",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("run_id", sa.Integer(), sa.ForeignKey("scraper_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="running"),
        sa.Column("pages", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("items_seen", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("items_saved", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("items_dropped", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("errors", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text()),
        sa.UniqueConstraint("run_id", "category", name="uq_run_category"),
    )
    op.add_column("current_prices", sa.Column("last_seen_run_id", sa.Integer()))
    op.create_foreign_key(
        "fk_current_prices_last_seen_run", "current_prices", "scraper_runs",
        ["last_seen_run_id"], ["id"], ondelete="SET NULL"
    )

    op.execute("""
        INSERT INTO scraper_configs
            (spider, store_id, display_name, is_enabled, schedule_type, interval_minutes, cron_expression, next_run_at)
        VALUES
            ('kontakt_home', 'kontakt_home', 'Kontakt Home', FALSE, 'cron', NULL, '0 */2 * * *', NOW()),
            ('baku_electronics', 'baku_electronics', 'Baku Electronics', FALSE, 'cron', NULL, '15 */4 * * *', NOW()),
            ('irshad_electronics', 'irshad_electronics', 'İrşad', FALSE, 'cron', NULL, '30 */4 * * *', NOW()),
            ('ispace', 'ispace', 'iSpace', FALSE, 'cron', NULL, '45 */4 * * *', NOW())
    """)


def downgrade() -> None:
    op.drop_constraint("fk_current_prices_last_seen_run", "current_prices", type_="foreignkey")
    op.drop_column("current_prices", "last_seen_run_id")
    op.drop_table("scraper_run_categories")
    op.drop_table("scraper_configs")
    op.drop_index("idx_scraper_runs_status", table_name="scraper_runs")
    for column in ("log_tail", "error_message", "items_dropped", "items_saved", "items_seen", "attempt", "trigger", "task_id"):
        op.drop_column("scraper_runs", column)

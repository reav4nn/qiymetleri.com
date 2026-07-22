import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (CheckConstraint("status IN ('draft','active','archived')"),)

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    labels: Mapped[dict] = mapped_column(JSONB, nullable=False)
    schema_revision: Mapped[int] = mapped_column(
        BigInteger, nullable=False, server_default="1"
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="draft"
    )


class ProductModel(Base):
    __tablename__ = "product_models"
    __table_args__ = (
        CheckConstraint("status IN ('provisional','verified','archived')"),
        CheckConstraint("slug = lower(slug) AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    category_id: Mapped[str] = mapped_column(
        ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    brand: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    slug: Mapped[str] = mapped_column(String(320), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="provisional"
    )
    spec_revision: Mapped[int] = mapped_column(
        BigInteger, nullable=False, server_default="1"
    )
    readiness_score: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, server_default="0"
    )
    is_comparison_ready: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    last_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    search_vector = mapped_column(TSVECTOR)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    products: Mapped[list["Product"]] = relationship(back_populates="model")


class ProductModelSlugAlias(Base):
    __tablename__ = "product_model_slug_aliases"

    alias: Mapped[str] = mapped_column(String(320), primary_key=True)
    model_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("product_models.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    created_by: Mapped[str] = mapped_column(String(200), nullable=False)


class MeasurementUnit(Base):
    __tablename__ = "measurement_units"

    code: Mapped[str] = mapped_column(String(30), primary_key=True)
    dimension: Mapped[str] = mapped_column(String(50), nullable=False)
    symbols: Mapped[dict] = mapped_column(JSONB, nullable=False)
    to_base_multiplier: Mapped[Decimal] = mapped_column(Numeric(24, 12), nullable=False)
    to_base_offset: Mapped[Decimal] = mapped_column(Numeric(24, 12), nullable=False)


class SpecGroup(Base):
    __tablename__ = "spec_groups"
    __table_args__ = (
        UniqueConstraint("category_id", "key"),
        UniqueConstraint("category_id", "sort_order"),
        UniqueConstraint("id", "category_id"),
        CheckConstraint("status IN ('draft','active','archived')"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    category_id: Mapped[str] = mapped_column(
        ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False
    )
    key: Mapped[str] = mapped_column(String(100), nullable=False)
    labels: Mapped[dict] = mapped_column(JSONB, nullable=False)
    sort_order: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="draft"
    )


class SpecDefinition(Base):
    __tablename__ = "spec_definitions"
    __table_args__ = (
        ForeignKeyConstraint(
            ["group_id", "category_id"],
            ["spec_groups.id", "spec_groups.category_id"],
            ondelete="RESTRICT",
        ),
        UniqueConstraint("category_id", "key", "schema_version"),
        CheckConstraint("scope IN ('model','variant','both')"),
        CheckConstraint(
            "value_type IN ('number','number_range','boolean','text','enum','number_list','option_set')"
        ),
        CheckConstraint(
            "comparison_rule IN ('higher_better','lower_better','true_better','false_better','difference_only')"
        ),
        CheckConstraint("precision BETWEEN 0 AND 8"),
        CheckConstraint("importance_weight > 0"),
        CheckConstraint("freshness_days > 0"),
        CheckConstraint("status IN ('draft','active','deprecated')"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    category_id: Mapped[str] = mapped_column(
        ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False
    )
    group_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    key: Mapped[str] = mapped_column(String(160), nullable=False)
    labels: Mapped[dict] = mapped_column(JSONB, nullable=False)
    description_labels: Mapped[dict | None] = mapped_column(JSONB)
    scope: Mapped[str] = mapped_column(String(20), nullable=False)
    value_type: Mapped[str] = mapped_column(String(20), nullable=False)
    canonical_unit: Mapped[str | None] = mapped_column(
        ForeignKey("measurement_units.code", ondelete="RESTRICT")
    )
    precision: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="0"
    )
    comparison_rule: Mapped[str] = mapped_column(String(30), nullable=False)
    absolute_tolerance: Mapped[Decimal] = mapped_column(
        Numeric(24, 8), nullable=False, server_default="0"
    )
    relative_tolerance: Mapped[Decimal] = mapped_column(
        Numeric(12, 8), nullable=False, server_default="0"
    )
    is_required: Mapped[bool] = mapped_column(Boolean, nullable=False)
    is_key: Mapped[bool] = mapped_column(Boolean, nullable=False)
    is_filterable: Mapped[bool] = mapped_column(Boolean, nullable=False)
    importance_weight: Mapped[Decimal] = mapped_column(Numeric(8, 3), nullable=False)
    sort_order: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    freshness_days: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="180"
    )
    schema_version: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="draft"
    )
    replaced_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("spec_definitions.id", ondelete="RESTRICT")
    )


class SpecOption(Base):
    __tablename__ = "spec_options"
    __table_args__ = (
        UniqueConstraint("definition_id", "key"),
        UniqueConstraint("definition_id", "sort_order"),
        CheckConstraint("status IN ('active','deprecated')"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    definition_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("spec_definitions.id", ondelete="RESTRICT"), nullable=False
    )
    key: Mapped[str] = mapped_column(String(100), nullable=False)
    labels: Mapped[dict] = mapped_column(JSONB, nullable=False)
    sort_order: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="active"
    )


class SourceDocument(Base):
    __tablename__ = "source_documents"
    __table_args__ = (
        CheckConstraint("source_type IN ('official','retailer','manual')"),
        CheckConstraint("parse_status IN ('pending','parsed','failed','tombstoned')"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    source_type: Mapped[str] = mapped_column(String(20), nullable=False)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    manufacturer_domain: Mapped[str | None] = mapped_column(String(255))
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    parser_name: Mapped[str] = mapped_column(String(100), nullable=False)
    parser_version: Mapped[str] = mapped_column(String(50), nullable=False)
    raw_payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    parse_status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="pending"
    )
    parse_error: Mapped[str | None] = mapped_column(Text)
    idempotency_key: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False
    )
    tombstoned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class SpecObservation(Base):
    __tablename__ = "spec_observations"
    __table_args__ = (
        CheckConstraint("num_nonnulls(model_id, product_id) = 1"),
        CheckConstraint(
            "status IN ('candidate','accepted','rejected','superseded','conflict')"
        ),
        CheckConstraint("confidence BETWEEN 0 AND 1"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    source_document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("source_documents.id", ondelete="RESTRICT"), nullable=False
    )
    definition_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("spec_definitions.id", ondelete="RESTRICT"), nullable=False
    )
    model_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("product_models.id", ondelete="RESTRICT")
    )
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT")
    )
    original_value: Mapped[str] = mapped_column(Text, nullable=False)
    original_unit: Mapped[str | None] = mapped_column(String(30))
    value_number: Mapped[Decimal | None] = mapped_column(Numeric(24, 8))
    range_min: Mapped[Decimal | None] = mapped_column(Numeric(24, 8))
    range_max: Mapped[Decimal | None] = mapped_column(Numeric(24, 8))
    value_boolean: Mapped[bool | None] = mapped_column(Boolean)
    value_text: Mapped[str | None] = mapped_column(Text)
    option_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("spec_options.id", ondelete="RESTRICT")
    )
    value_json: Mapped[list | None] = mapped_column(JSONB)
    confidence: Mapped[Decimal] = mapped_column(Numeric(4, 3), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="candidate"
    )
    observed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    created_by: Mapped[str] = mapped_column(String(200), nullable=False)


class CanonicalSpecValue(Base):
    __tablename__ = "canonical_spec_values"
    __table_args__ = (CheckConstraint("num_nonnulls(model_id, product_id) = 1"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    definition_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("spec_definitions.id", ondelete="RESTRICT"), nullable=False
    )
    selected_observation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("spec_observations.id", ondelete="RESTRICT"),
        nullable=False,
        unique=True,
    )
    model_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("product_models.id", ondelete="RESTRICT")
    )
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT")
    )
    value_number: Mapped[Decimal | None] = mapped_column(Numeric(24, 8))
    range_min: Mapped[Decimal | None] = mapped_column(Numeric(24, 8))
    range_max: Mapped[Decimal | None] = mapped_column(Numeric(24, 8))
    value_boolean: Mapped[bool | None] = mapped_column(Boolean)
    value_text: Mapped[str | None] = mapped_column(Text)
    option_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("spec_options.id", ondelete="RESTRICT")
    )
    value_json: Mapped[list | None] = mapped_column(JSONB)
    revision: Mapped[int] = mapped_column(
        BigInteger, nullable=False, server_default="1"
    )
    verified_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_by: Mapped[str] = mapped_column(String(200), nullable=False)


class SpecAuditEvent(Base):
    __tablename__ = "spec_audit_events"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    actor: Mapped[str] = mapped_column(String(200), nullable=False)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(255), nullable=False)
    before: Mapped[dict | None] = mapped_column(JSONB)
    after: Mapped[dict | None] = mapped_column(JSONB)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    source_document_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("source_documents.id", ondelete="RESTRICT")
    )
    observation_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("spec_observations.id", ondelete="RESTRICT")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class SpecModerationCase(Base):
    __tablename__ = "spec_moderation_cases"
    __table_args__ = (
        CheckConstraint("case_type IN ('mapping','conflict','incomplete','stale')"),
        CheckConstraint("status IN ('open','assigned','resolved','dismissed')"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    case_type: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="open"
    )
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(255), nullable=False)
    definition_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("spec_definitions.id", ondelete="RESTRICT")
    )
    source_document_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("source_documents.id", ondelete="RESTRICT")
    )
    assignee: Mapped[str | None] = mapped_column(String(200))
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolution: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class SpecIngestionRun(Base):
    __tablename__ = "spec_ingestion_runs"
    __table_args__ = (
        CheckConstraint("status IN ('queued','running','success','failed')"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    task_id: Mapped[str | None] = mapped_column(String(100), unique=True)
    source_adapter: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="queued"
    )
    attempt: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    documents_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    observations_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    errors_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    error: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ModelMappingReview(Base):
    __tablename__ = "model_mapping_reviews"
    __table_args__ = (
        CheckConstraint("status IN ('pending','accepted','rejected')"),
        CheckConstraint("confidence BETWEEN 0 AND 1"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), nullable=False
    )
    proposed_model_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("product_models.id", ondelete="RESTRICT")
    )
    current_model_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("product_models.id", ondelete="RESTRICT")
    )
    confidence: Mapped[Decimal] = mapped_column(Numeric(4, 3), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="pending"
    )
    reviewer: Mapped[str | None] = mapped_column(String(200))
    resolution_reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ComparisonPage(Base):
    __tablename__ = "comparison_pages"
    __table_args__ = (
        CheckConstraint("model_a_id < model_b_id"),
        UniqueConstraint("model_a_id", "model_b_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    model_a_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("product_models.id", ondelete="RESTRICT"), nullable=False
    )
    model_b_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("product_models.id", ondelete="RESTRICT"), nullable=False
    )
    is_indexable: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    metadata_labels: Mapped[dict] = mapped_column(JSONB, nullable=False)
    updated_by: Mapped[str] = mapped_column(String(200), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class ModelBackfillRun(Base):
    __tablename__ = "model_backfill_runs"
    __table_args__ = (CheckConstraint("status IN ('running','completed','failed')"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="running"
    )
    batch_size: Mapped[int] = mapped_column(Integer, nullable=False)
    batches_completed: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    products_processed: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    last_product_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    baseline: Mapped[dict] = mapped_column(JSONB, nullable=False)
    result: Mapped[dict | None] = mapped_column(JSONB)
    error: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


# Resolve forward references used only for ORM relationship typing.
from app.models.product import Product  # noqa: E402,F401

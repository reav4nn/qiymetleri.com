import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Store(Base):
    __tablename__ = "stores"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    base_url: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    current_prices: Mapped[list["CurrentPrice"]] = relationship(
        back_populates="store"
    )


class Product(Base):
    __tablename__ = "products"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    canonical_id: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    brand: Mapped[str | None] = mapped_column(String(100), index=True)
    category: Mapped[str | None] = mapped_column(String(100), index=True)
    model_family: Mapped[str | None] = mapped_column(String(200))
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    image_url: Mapped[str | None] = mapped_column(Text)
    attributes: Mapped[dict | None] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    current_prices: Mapped[list["CurrentPrice"]] = relationship(
        back_populates="product", lazy="selectin"
    )


class CurrentPrice(Base):
    __tablename__ = "current_prices"
    __table_args__ = (
        UniqueConstraint("product_id", "store_id", name="uq_product_store"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True
    )
    store_id: Mapped[str] = mapped_column(
        String(100), ForeignKey("stores.id"), nullable=False, index=True
    )
    price_azn: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    original_title: Mapped[str | None] = mapped_column(Text)
    url: Mapped[str | None] = mapped_column(Text)
    in_stock: Mapped[bool] = mapped_column(Boolean, default=True)
    last_checked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    product: Mapped["Product"] = relationship(back_populates="current_prices")
    store: Mapped["Store"] = relationship(back_populates="current_prices")


class PriceHistory(Base):
    __tablename__ = "price_history"

    time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), primary_key=True, nullable=False
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, nullable=False, index=True
    )
    store_id: Mapped[str] = mapped_column(
        String(100), primary_key=True, nullable=False
    )
    price_azn: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    in_stock: Mapped[bool | None] = mapped_column(Boolean)

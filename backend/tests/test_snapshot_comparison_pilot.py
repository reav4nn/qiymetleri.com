from datetime import datetime, timezone
from decimal import Decimal

import pytest

from scripts.snapshot_comparison_pilot import (
    PILOT_LIMIT,
    SELECTION_RULE,
    build_snapshot,
    select_pilot_candidates,
)


def test_build_snapshot_preserves_database_rank_and_normalizes_values() -> None:
    generated_at = datetime(2026, 7, 22, 12, 0, tzinfo=timezone.utc)
    rows = [
        {
            "brand_key": "apple",
            "brand": "Apple",
            "model_family": "iPhone Fixture Pro",
            "representative_product_id": "00000000-0000-0000-0000-000000000001",
            "variant_count": 4,
            "store_count": 3,
            "lowest_price": Decimal("1999.90"),
        },
        {
            "brand_key": "fixture",
            "brand": "Fixture",
            "model_family": "Budget Phone",
            "representative_product_id": "00000000-0000-0000-0000-000000000002",
            "variant_count": 1,
            "store_count": 1,
            "lowest_price": None,
        },
    ]

    snapshot = build_snapshot(rows, generated_at)

    assert snapshot["limit"] == PILOT_LIMIT
    assert snapshot["selection_rule"] == SELECTION_RULE
    assert snapshot["models"][0] == {
        "rank": 1,
        "pilot_key": "apple:iphone fixture pro",
        "brand": "Apple",
        "model_family": "iPhone Fixture Pro",
        "representative_product_id": "00000000-0000-0000-0000-000000000001",
        "variant_count": 4,
        "store_count": 3,
        "lowest_price_azn": 1999.9,
    }
    assert snapshot["models"][1]["lowest_price_azn"] is None


class EmptyMappings:
    def all(self):
        return []


class EmptyResult:
    def mappings(self):
        return EmptyMappings()


class RecordingSession:
    def __init__(self):
        self.params = None

    async def execute(self, statement, params):
        self.params = params
        return EmptyResult()


@pytest.mark.asyncio
async def test_selector_is_smartphone_only_and_bounded() -> None:
    session = RecordingSession()

    assert await select_pilot_candidates(session, limit=20) == []
    assert session.params == {"category": "smartphones", "limit": 20}

    with pytest.raises(ValueError):
        await select_pilot_candidates(session, limit=PILOT_LIMIT + 1)

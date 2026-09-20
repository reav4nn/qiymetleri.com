from decimal import Decimal

import pytest

from app.services.matching_service import (
    generate_match_suggestions,
    has_version_conflict,
)


def test_version_conflict_rejects_different_generations() -> None:
    assert has_version_conflict("iPhone 16 Pro", "iPhone 17 Pro")
    assert has_version_conflict("Samsung Galaxy A55", "Samsung Galaxy A56")
    assert has_version_conflict("Apple Watch Series 10", "Apple Watch Series 11")


def test_version_conflict_allows_same_generation_variants() -> None:
    assert not has_version_conflict("iPhone 16 Pro", "Apple iPhone 16 Pro")
    assert not has_version_conflict("Samsung Galaxy S25", "Galaxy S25 5G")


class FakeResult:
    def __init__(self, *, rows=None, first=None):
        self._rows = rows or []
        self._first = first

    def all(self):
        return self._rows

    def first(self):
        return self._first


class FakeDatabase:
    def __init__(self):
        self.calls = []
        self.committed = False

    async def execute(self, statement, params):
        self.calls.append((str(statement), params))
        if len(self.calls) == 1:
            return FakeResult(
                rows=[
                    (
                        "iPhone 16 Pro",
                        "Apple iPhone 16 Pro",
                        "apple",
                        Decimal("0.81"),
                    ),
                    (
                        "iPhone 16 Pro",
                        "iPhone 17 Pro",
                        "apple",
                        Decimal("0.79"),
                    ),
                ]
            )
        return FakeResult(first=(42,))

    async def commit(self):
        self.committed = True


@pytest.mark.asyncio
async def test_generate_match_suggestions_creates_reviewable_candidates() -> None:
    database = FakeDatabase()

    result = await generate_match_suggestions(database)

    assert result == {
        "candidates": 2,
        "created": 1,
        "skipped_version_conflicts": 1,
    }
    assert len(database.calls) == 2
    assert database.calls[1][1]["family_b"] == "Apple iPhone 16 Pro"
    assert database.committed

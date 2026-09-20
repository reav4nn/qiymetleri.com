from unittest.mock import AsyncMock

import pytest

from app.api.v1.endpoints import filters


class EmptyResult:
    def __iter__(self):
        return iter(())

    def first(self):
        return None


class RecordingDatabase:
    def __init__(self):
        self.statements = []

    async def execute(self, statement):
        self.statements.append(statement)
        return EmptyResult()


@pytest.mark.asyncio
async def test_filters_scope_product_context_by_brand(monkeypatch) -> None:
    monkeypatch.setattr(filters, "get_cache", AsyncMock(return_value=None))
    monkeypatch.setattr(filters, "set_cache", AsyncMock())
    database = RecordingDatabase()

    await filters.get_filters(
        q=None,
        category=None,
        brand="Apple",
        store_id=None,
        min_price=None,
        max_price=None,
        db=database,
    )

    compiled = database.statements[0].compile()
    assert any(value == "Apple" for value in compiled.params.values())

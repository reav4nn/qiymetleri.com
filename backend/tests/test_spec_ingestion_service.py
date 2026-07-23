import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest

from app.services.spec_ingestion_service import (
    SpecValueError,
    _json,
    make_import_token,
    verify_import_token,
)


def test_import_token_binds_payload_and_expires() -> None:
    now = datetime(2026, 7, 23, 10, 0, tzinfo=timezone.utc)
    rows = [
        {
            "model_id": "00000000-0000-0000-0000-000000000001",
            "definition_key": "display.refresh_rate",
            "value": 120,
            "unit": "hz",
        }
    ]
    token = make_import_token(rows, "test-secret", now)
    verify_import_token(token, rows, "test-secret", now + timedelta(minutes=29))

    with pytest.raises(SpecValueError):
        verify_import_token(token, [{**rows[0], "value": 60}], "test-secret", now)
    with pytest.raises(SpecValueError):
        verify_import_token(token, rows, "test-secret", now + timedelta(minutes=31))


def test_json_keeps_decimal_array_items_numeric_for_database_invariants() -> None:
    encoded = _json({"values": [Decimal("1"), Decimal("1.25")]})
    assert json.loads(encoded, parse_float=Decimal) == {"values": [1, Decimal("1.25")]}

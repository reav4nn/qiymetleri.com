from decimal import Decimal

import pytest

from shared.spec_ingestion import (
    AppleSmartphoneAdapter,
    SamsungSmartphoneAdapter,
    SpecValueError,
    convert_number,
    idempotency_key,
    normalize_value,
    validate_source_url,
    values_equivalent,
)


def definition(value_type, **overrides):
    result = {
        "value_type": value_type,
        "precision": 0,
        "canonical_unit": None,
    }
    result.update(overrides)
    return result


def test_decimal_unit_conversion_uses_dimension_base() -> None:
    assert convert_number(
        6.1,
        source_multiplier="25.4",
        source_offset="0",
        target_multiplier="1",
        target_offset="0",
        precision=2,
    ) == Decimal("154.94")


def test_normalize_value_supports_every_contract_type() -> None:
    units = {
        "inch": {
            "dimension": "length",
            "to_base_multiplier": "25.4",
            "to_base_offset": "0",
        },
        "mm": {
            "dimension": "length",
            "to_base_multiplier": "1",
            "to_base_offset": "0",
        },
    }
    options = {"oled": "00000000-0000-0000-0000-000000000001", "ips": "two"}

    number = normalize_value(
        definition("number", precision=2, canonical_unit="mm"),
        6.1,
        original_unit="inch",
        units=units,
    )
    assert number["value_number"] == Decimal("154.94")
    assert normalize_value(definition("number_range"), [1, 2])["range_max"] == 2
    assert normalize_value(definition("boolean"), True)["value_boolean"] is True
    assert normalize_value(definition("text"), "  Ceramic  ")["value_text"] == "Ceramic"
    assert normalize_value(definition("enum"), "oled", options=options)[
        "option_id"
    ].endswith("1")
    assert normalize_value(definition("number_list"), [24, 30, 60])["value_json"] == [
        Decimal("24"),
        Decimal("30"),
        Decimal("60"),
    ]
    assert normalize_value(definition("option_set"), ["ips", "oled"], options=options)[
        "value_json"
    ] == ["ips", "oled"]


def test_invalid_values_are_rejected_before_database_write() -> None:
    with pytest.raises(SpecValueError, match="true or false"):
        normalize_value(definition("boolean"), "yes")
    with pytest.raises(SpecValueError, match="duplicate"):
        normalize_value(
            definition("option_set"),
            ["oled", "oled"],
            options={"oled": "id"},
        )
    with pytest.raises(SpecValueError, match="minimum"):
        normalize_value(definition("number_range"), [2, 1])


def test_numeric_equivalence_uses_absolute_or_relative_tolerance() -> None:
    assert values_equivalent(
        "number",
        {"value_number": Decimal("100")},
        {"value_number": Decimal("101")},
        absolute_tolerance="0.5",
        relative_tolerance="0.02",
    )
    assert not values_equivalent(
        "number",
        {"value_number": Decimal("100")},
        {"value_number": Decimal("104")},
        absolute_tolerance="1",
        relative_tolerance="0.02",
    )


def test_source_url_allowlist_blocks_ssrf_shapes() -> None:
    assert (
        validate_source_url("https://www.apple.com/iphone/specs", {"www.apple.com"})
        == "www.apple.com"
    )
    for url in (
        "http://www.apple.com/specs",
        "https://user:pass@www.apple.com/specs",
        "https://www.apple.com:8443/specs",
        "https://apple.com.evil.example/specs",
        "https://127.0.0.1/specs",
    ):
        with pytest.raises(SpecValueError):
            validate_source_url(url, {"www.apple.com"})


def test_official_adapter_parsing_and_document_key_are_deterministic() -> None:
    adapter = AppleSmartphoneAdapter()
    payload = {
        "specifications": {
            "display.refresh_rate": {"value": 120, "unit": "hz"},
            "battery.wireless_charging": True,
        }
    }
    observations = adapter.parse(payload)
    assert [item.key for item in observations] == [
        "display.refresh_rate",
        "battery.wireless_charging",
    ]
    first = idempotency_key(
        source_type="official",
        source_url="https://www.apple.com/iphone/specs",
        parser_name=adapter.name,
        parser_version=adapter.version,
        payload=payload,
    )
    second = idempotency_key(
        source_type="official",
        source_url="https://www.apple.com/iphone/specs",
        parser_name=adapter.name,
        parser_version=adapter.version,
        payload={
            "specifications": {
                "battery.wireless_charging": True,
                "display.refresh_rate": {"unit": "hz", "value": 120},
            }
        },
    )
    assert first == second


def test_samsung_adapter_accepts_only_product_and_newsroom_hosts() -> None:
    adapter = SamsungSmartphoneAdapter()
    assert (
        adapter.validate_url(
            "https://news.samsung.com/global/enter-the-new-era-of-mobile-ai"
        )
        == "news.samsung.com"
    )
    assert (
        adapter.validate_url("https://www.samsung.com/latin/smartphones/galaxy-s24")
        == "www.samsung.com"
    )
    with pytest.raises(SpecValueError):
        adapter.validate_url("https://news.samsung.com.evil.example/galaxy-s24")

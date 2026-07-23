"""Safe, deterministic helpers shared by specification ingestion workers."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any
from urllib.parse import urlparse

SOURCE_PRIORITIES = {"retailer": 100, "official": 200, "manual": 300}
NUMERIC_TYPES = {"number", "number_range", "number_list"}


class SpecValueError(ValueError):
    """Raised when an observed value cannot satisfy its taxonomy definition."""


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def content_hash(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode()).hexdigest()


def idempotency_key(
    *,
    source_type: str,
    source_url: str,
    parser_name: str,
    parser_version: str,
    payload: Any,
) -> str:
    material = {
        "source_type": source_type,
        "source_url": source_url,
        "parser_name": parser_name,
        "parser_version": parser_version,
        "content_hash": content_hash(payload),
    }
    return content_hash(material)


def validate_source_url(url: str, allowed_hosts: set[str]) -> str:
    """Reject non-HTTPS, credentialed, port-changing, or non-allowlisted URLs."""
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower().rstrip(".")
    normalized_hosts = {item.lower().rstrip(".") for item in allowed_hosts}
    if (
        parsed.scheme != "https"
        or not host
        or parsed.username
        or parsed.password
        or parsed.port not in {None, 443}
        or host not in normalized_hosts
    ):
        raise SpecValueError("source URL is not an allowlisted HTTPS manufacturer URL")
    return host


def to_decimal(value: Any, field: str = "value") -> Decimal:
    if isinstance(value, bool):
        raise SpecValueError(f"{field} must be numeric")
    try:
        number = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise SpecValueError(f"{field} must be numeric") from exc
    if not number.is_finite():
        raise SpecValueError(f"{field} must be finite")
    return number


def convert_number(
    value: Any,
    *,
    source_multiplier: Any,
    source_offset: Any,
    target_multiplier: Any,
    target_offset: Any,
    precision: int,
) -> Decimal:
    """Convert through a dimension base value using Decimal only."""
    source = to_decimal(value)
    base = source * to_decimal(source_multiplier) + to_decimal(source_offset)
    target = (base - to_decimal(target_offset)) / to_decimal(target_multiplier)
    quantum = Decimal(1).scaleb(-precision)
    return target.quantize(quantum)


def values_equivalent(
    value_type: str,
    left: dict[str, Any],
    right: dict[str, Any],
    *,
    absolute_tolerance: Any = 0,
    relative_tolerance: Any = 0,
) -> bool:
    if value_type == "number":
        first = to_decimal(left["value_number"])
        second = to_decimal(right["value_number"])
        delta = abs(first - second)
        allowed = max(
            to_decimal(absolute_tolerance),
            max(abs(first), abs(second)) * to_decimal(relative_tolerance),
        )
        return delta <= allowed
    if value_type == "number_range":
        return left.get("range_min") == right.get("range_min") and left.get(
            "range_max"
        ) == right.get("range_max")
    branch = {
        "boolean": "value_boolean",
        "text": "value_text",
        "enum": "option_id",
        "number_list": "value_json",
        "option_set": "value_json",
    }[value_type]
    left_value, right_value = left.get(branch), right.get(branch)
    if value_type == "option_set":
        return set(left_value or []) == set(right_value or [])
    return left_value == right_value


def normalize_value(
    definition: dict[str, Any],
    raw_value: Any,
    *,
    original_unit: str | None = None,
    units: dict[str, dict[str, Any]] | None = None,
    options: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Return exactly one typed database value branch for a definition."""
    value_type = definition["value_type"]
    result = {
        "value_number": None,
        "range_min": None,
        "range_max": None,
        "value_boolean": None,
        "value_text": None,
        "option_id": None,
        "value_json": None,
    }
    precision = int(definition.get("precision", 0))
    canonical_unit = definition.get("canonical_unit")

    def numeric(value: Any) -> Decimal:
        if original_unit and canonical_unit and original_unit != canonical_unit:
            known = units or {}
            source, target = known.get(original_unit), known.get(canonical_unit)
            if not source or not target or source["dimension"] != target["dimension"]:
                raise SpecValueError("unit is unknown or dimension does not match")
            return convert_number(
                value,
                source_multiplier=source["to_base_multiplier"],
                source_offset=source["to_base_offset"],
                target_multiplier=target["to_base_multiplier"],
                target_offset=target["to_base_offset"],
                precision=precision,
            )
        return to_decimal(value).quantize(Decimal(1).scaleb(-precision))

    if value_type == "number":
        result["value_number"] = numeric(raw_value)
    elif value_type == "number_range":
        if not isinstance(raw_value, (list, tuple)) or len(raw_value) != 2:
            raise SpecValueError("number_range requires [minimum, maximum]")
        result["range_min"], result["range_max"] = (numeric(item) for item in raw_value)
        if result["range_min"] > result["range_max"]:
            raise SpecValueError("range minimum cannot exceed maximum")
    elif value_type == "boolean":
        if type(raw_value) is not bool:
            raise SpecValueError("boolean value must be true or false")
        result["value_boolean"] = raw_value
    elif value_type == "text":
        if not isinstance(raw_value, str) or not raw_value.strip():
            raise SpecValueError("text value must be non-empty")
        result["value_text"] = raw_value.strip()
    elif value_type == "enum":
        key = str(raw_value).strip()
        if key not in (options or {}):
            raise SpecValueError(f"unknown option: {key}")
        result["option_id"] = options[key]
    elif value_type == "number_list":
        if not isinstance(raw_value, list) or not raw_value:
            raise SpecValueError("number_list requires a non-empty array")
        result["value_json"] = [numeric(item) for item in raw_value]
    elif value_type == "option_set":
        if not isinstance(raw_value, list) or not raw_value:
            raise SpecValueError("option_set requires a non-empty array")
        values = [str(item).strip() for item in raw_value]
        if len(values) != len(set(values)) or any(
            item not in (options or {}) for item in values
        ):
            raise SpecValueError("option_set contains an unknown or duplicate option")
        result["value_json"] = sorted(values)
    else:
        raise SpecValueError(f"unsupported value type: {value_type}")
    return result


@dataclass(frozen=True)
class ParsedObservation:
    key: str
    value: Any
    unit: str | None = None
    confidence: Decimal = Decimal("1")
    target: str = "model"


class OfficialSmartphoneAdapter:
    """Base for manufacturer-owned JSON feeds configured outside the admin UI."""

    name = "official-generic"
    version = "1"
    allowed_hosts: frozenset[str] = frozenset()
    aliases: dict[str, str] = {}

    def validate_url(self, url: str) -> str:
        return validate_source_url(url, set(self.allowed_hosts))

    def parse(self, payload: dict[str, Any]) -> list[ParsedObservation]:
        specs = payload.get("specifications")
        if not isinstance(specs, dict):
            raise SpecValueError(
                "official payload must contain a specifications object"
            )
        observations: list[ParsedObservation] = []
        for source_key, source_value in specs.items():
            key = self.aliases.get(source_key, source_key)
            unit = None
            value = source_value
            if isinstance(source_value, dict) and "value" in source_value:
                value = source_value["value"]
                unit = source_value.get("unit")
            observations.append(ParsedObservation(key=key, value=value, unit=unit))
        return observations


class AppleSmartphoneAdapter(OfficialSmartphoneAdapter):
    name = "apple-smartphones"
    allowed_hosts = frozenset({"www.apple.com", "support.apple.com"})


class SamsungSmartphoneAdapter(OfficialSmartphoneAdapter):
    name = "samsung-smartphones"
    allowed_hosts = frozenset({"www.samsung.com", "news.samsung.com"})


class GoogleSmartphoneAdapter(OfficialSmartphoneAdapter):
    name = "google-pixel"
    allowed_hosts = frozenset({"store.google.com", "support.google.com"})


class XiaomiSmartphoneAdapter(OfficialSmartphoneAdapter):
    name = "xiaomi-smartphones"
    allowed_hosts = frozenset({"www.mi.com"})


OFFICIAL_ADAPTERS = {
    adapter.name: adapter
    for adapter in (
        AppleSmartphoneAdapter(),
        SamsungSmartphoneAdapter(),
        GoogleSmartphoneAdapter(),
        XiaomiSmartphoneAdapter(),
    )
}

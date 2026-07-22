"""Validation and loading for versioned comparison specification contracts."""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import UUID

SUPPORTED_LOCALES = ("az", "ru")
SUPPORTED_SCOPES = {"model", "variant", "both"}
SUPPORTED_VALUE_TYPES = {
    "number",
    "number_range",
    "boolean",
    "text",
    "enum",
    "number_list",
    "option_set",
}
SUPPORTED_COMPARISON_RULES = {
    "higher_better",
    "lower_better",
    "true_better",
    "false_better",
    "difference_only",
}
NUMERIC_TYPES = {"number", "number_range", "number_list"}
OPTION_TYPES = {"enum", "option_set"}
KEY_PATTERN = re.compile(r"^[a-z][a-z0-9]*(?:[._][a-z0-9]+)*$")
RESERVED_SCORE_TOKENS = {"overall_score", "overall_winner", "product_score"}

PACKAGE_DIR = Path(__file__).resolve().parent
SMARTPHONE_TAXONOMY_PATH = PACKAGE_DIR / "specs" / "smartphones.v1.json"
SMARTPHONE_FIXTURE_PATH = PACKAGE_DIR / "specs" / "fixtures" / "smartphones.v1.json"
SMARTPHONE_CASE_FIXTURE_PATH = (
    PACKAGE_DIR / "specs" / "fixtures" / "comparison-cases.v1.json"
)
SMARTPHONE_PILOT_PATH = PACKAGE_DIR / "specs" / "pilot" / "smartphones-2026-07-22.json"


class TaxonomyValidationError(ValueError):
    """Raised when a taxonomy or fixture violates the comparison contract."""

    def __init__(self, errors: list[str]):
        self.errors = errors
        super().__init__("\n".join(errors))


def load_json(path: Path) -> dict[str, Any]:
    """Load a UTF-8 JSON object from disk."""
    with path.open(encoding="utf-8") as file:
        data = json.load(file)
    if not isinstance(data, dict):
        raise TaxonomyValidationError([f"{path}: root must be an object"])
    return data


def _valid_labels(value: Any) -> bool:
    if not isinstance(value, dict):
        return False
    return all(
        isinstance(value.get(locale), str) and value[locale].strip()
        for locale in SUPPORTED_LOCALES
    )


def _duplicates(values: list[Any]) -> set[Any]:
    seen: set[Any] = set()
    duplicates: set[Any] = set()
    for value in values:
        if value in seen:
            duplicates.add(value)
        seen.add(value)
    return duplicates


def _is_number(value: Any) -> bool:
    return type(value) in {int, float}


def _definition_options(definition: dict[str, Any]) -> set[str]:
    return {
        option["key"]
        for option in definition.get("options", [])
        if isinstance(option, dict) and isinstance(option.get("key"), str)
    }


def validate_taxonomy(data: dict[str, Any]) -> None:
    """Validate the complete category taxonomy and raise all found errors."""
    errors: list[str] = []

    if not isinstance(data.get("contract_version"), int):
        errors.append("contract_version must be an integer")

    category = data.get("category")
    if not isinstance(category, dict):
        errors.append("category must be an object")
    else:
        if category.get("id") != "smartphones":
            errors.append("category.id must be smartphones for this contract")
        if not _valid_labels(category.get("labels")):
            errors.append("category.labels must contain non-empty az and ru strings")

    units = data.get("units")
    if not isinstance(units, list):
        errors.append("units must be an array")
        units = []
    unit_codes = [unit.get("code") for unit in units if isinstance(unit, dict)]
    for duplicate in sorted(_duplicates(unit_codes)):
        errors.append(f"duplicate unit code: {duplicate}")
    for index, unit in enumerate(units):
        context = f"units[{index}]"
        if not isinstance(unit, dict):
            errors.append(f"{context} must be an object")
            continue
        if not KEY_PATTERN.fullmatch(str(unit.get("code", ""))):
            errors.append(f"{context}.code is not a stable key")
        if not isinstance(unit.get("dimension"), str) or not unit["dimension"]:
            errors.append(f"{context}.dimension must be non-empty")
        if not _valid_labels(unit.get("symbols")):
            errors.append(f"{context}.symbols must contain az and ru")
        for field in ("to_base_multiplier", "to_base_offset"):
            if not _is_number(unit.get(field)):
                errors.append(f"{context}.{field} must be numeric")

    groups = data.get("groups")
    if not isinstance(groups, list):
        errors.append("groups must be an array")
        groups = []
    group_keys = [group.get("key") for group in groups if isinstance(group, dict)]
    group_orders = [
        group.get("sort_order") for group in groups if isinstance(group, dict)
    ]
    for duplicate in sorted(_duplicates(group_keys)):
        errors.append(f"duplicate group key: {duplicate}")
    for duplicate in sorted(_duplicates(group_orders)):
        errors.append(f"duplicate group sort_order: {duplicate}")
    for index, group in enumerate(groups):
        context = f"groups[{index}]"
        if not isinstance(group, dict):
            errors.append(f"{context} must be an object")
            continue
        if not KEY_PATTERN.fullmatch(str(group.get("key", ""))):
            errors.append(f"{context}.key is not a stable key")
        if not isinstance(group.get("sort_order"), int):
            errors.append(f"{context}.sort_order must be an integer")
        if not _valid_labels(group.get("labels")):
            errors.append(f"{context}.labels must contain az and ru")

    definitions = data.get("definitions")
    if not isinstance(definitions, list):
        errors.append("definitions must be an array")
        definitions = []
    definition_keys = [
        definition.get("key")
        for definition in definitions
        if isinstance(definition, dict)
    ]
    for duplicate in sorted(_duplicates(definition_keys)):
        errors.append(f"duplicate definition key: {duplicate}")

    orders_by_group: dict[str, list[int]] = {}
    known_groups = set(group_keys)
    known_units = set(unit_codes)
    for index, definition in enumerate(definitions):
        context = f"definitions[{index}]"
        if not isinstance(definition, dict):
            errors.append(f"{context} must be an object")
            continue

        key = str(definition.get("key", ""))
        group = definition.get("group")
        value_type = definition.get("value_type")
        comparison_rule = definition.get("comparison_rule")
        scope = definition.get("scope")

        if not KEY_PATTERN.fullmatch(key):
            errors.append(f"{context}.key is not a stable key")
        if key in RESERVED_SCORE_TOKENS or any(
            token in key for token in RESERVED_SCORE_TOKENS
        ):
            errors.append(f"{key}: aggregate product scoring is forbidden")
        if group not in known_groups:
            errors.append(f"{key}: unknown group {group}")
        if scope not in SUPPORTED_SCOPES:
            errors.append(f"{key}: unsupported scope {scope}")
        if value_type not in SUPPORTED_VALUE_TYPES:
            errors.append(f"{key}: unsupported value_type {value_type}")
        if comparison_rule not in SUPPORTED_COMPARISON_RULES:
            errors.append(f"{key}: unsupported comparison_rule {comparison_rule}")
        if not _valid_labels(definition.get("labels")):
            errors.append(f"{key}: labels must contain az and ru")

        sort_order = definition.get("sort_order")
        if not isinstance(sort_order, int):
            errors.append(f"{key}: sort_order must be an integer")
        elif isinstance(group, str):
            orders_by_group.setdefault(group, []).append(sort_order)

        weight = definition.get("importance_weight")
        if not _is_number(weight) or weight <= 0:
            errors.append(f"{key}: importance_weight must be positive")
        freshness_days = definition.get("freshness_days")
        if not isinstance(freshness_days, int) or freshness_days <= 0:
            errors.append(f"{key}: freshness_days must be a positive integer")
        for field in ("is_required", "is_key", "is_filterable"):
            if not isinstance(definition.get(field), bool):
                errors.append(f"{key}: {field} must be boolean")

        canonical_unit = definition.get("canonical_unit")
        if canonical_unit is not None:
            if value_type not in NUMERIC_TYPES:
                errors.append(f"{key}: only numeric types may have a unit")
            if canonical_unit not in known_units:
                errors.append(f"{key}: unknown unit {canonical_unit}")
        if value_type in NUMERIC_TYPES:
            for field in ("absolute_tolerance", "relative_tolerance"):
                tolerance = definition.get(field, 0)
                if not _is_number(tolerance) or tolerance < 0:
                    errors.append(f"{key}: {field} must be non-negative")

        if comparison_rule in {"higher_better", "lower_better"}:
            if value_type != "number":
                errors.append(f"{key}: numeric advantage requires number type")
        elif comparison_rule in {"true_better", "false_better"}:
            if value_type != "boolean":
                errors.append(f"{key}: boolean advantage requires boolean type")
        elif value_type not in {"number", "boolean"}:
            if comparison_rule != "difference_only":
                errors.append(f"{key}: this type must use difference_only")

        options = definition.get("options")
        if value_type in OPTION_TYPES:
            if not isinstance(options, list) or not options:
                errors.append(f"{key}: options are required")
                continue
            option_keys = [
                option.get("key") for option in options if isinstance(option, dict)
            ]
            option_orders = [
                option.get("sort_order")
                for option in options
                if isinstance(option, dict)
            ]
            for duplicate in sorted(_duplicates(option_keys)):
                errors.append(f"{key}: duplicate option key {duplicate}")
            for duplicate in sorted(_duplicates(option_orders)):
                errors.append(f"{key}: duplicate option sort_order {duplicate}")
            for option in options:
                if not isinstance(option, dict):
                    errors.append(f"{key}: every option must be an object")
                    continue
                if not KEY_PATTERN.fullmatch(str(option.get("key", ""))):
                    errors.append(f"{key}: option key is not stable")
                if not isinstance(option.get("sort_order"), int):
                    errors.append(f"{key}: option sort_order must be an integer")
                if not _valid_labels(option.get("labels")):
                    errors.append(f"{key}: option labels must contain az and ru")
        elif options is not None:
            errors.append(f"{key}: options are only valid for enum/option_set")

    for group, sort_orders in orders_by_group.items():
        for duplicate in sorted(_duplicates(sort_orders)):
            errors.append(f"{group}: duplicate definition sort_order {duplicate}")

    missing_types = SUPPORTED_VALUE_TYPES - {
        definition.get("value_type")
        for definition in definitions
        if isinstance(definition, dict)
    }
    if missing_types:
        errors.append(f"taxonomy does not cover value types: {sorted(missing_types)}")

    if errors:
        raise TaxonomyValidationError(errors)


def _validate_value(
    definition: dict[str, Any], value: Any, context: str, errors: list[str]
) -> None:
    value_type = definition["value_type"]
    if value_type == "number" and not _is_number(value):
        errors.append(f"{context}: expected number")
    elif value_type == "number_range":
        if not isinstance(value, dict) or set(value) != {"min", "max"}:
            errors.append(f"{context}: expected {{min, max}} range")
        elif not _is_number(value["min"]) or not _is_number(value["max"]):
            errors.append(f"{context}: range bounds must be numeric")
        elif value["min"] > value["max"]:
            errors.append(f"{context}: range min must not exceed max")
    elif value_type == "boolean" and type(value) is not bool:
        errors.append(f"{context}: expected boolean")
    elif value_type == "text":
        if not isinstance(value, str) or not value.strip():
            errors.append(f"{context}: expected non-empty text")
    elif value_type == "enum":
        if not isinstance(value, str) or value not in _definition_options(definition):
            errors.append(f"{context}: unknown enum option {value}")
    elif value_type == "number_list":
        if not isinstance(value, list) or not all(_is_number(item) for item in value):
            errors.append(f"{context}: expected an array of numbers")
    elif value_type == "option_set":
        if not isinstance(value, list) or not all(
            isinstance(item, str) for item in value
        ):
            errors.append(f"{context}: expected an array of option keys")
        else:
            unknown = set(value) - _definition_options(definition)
            if unknown:
                errors.append(f"{context}: unknown options {sorted(unknown)}")
            if len(value) != len(set(value)):
                errors.append(f"{context}: option_set must be unique")


def validate_fixture(taxonomy: dict[str, Any], fixture: dict[str, Any]) -> None:
    """Validate representative model/variant fixtures against a taxonomy."""
    validate_taxonomy(taxonomy)
    errors: list[str] = []
    category_id = taxonomy["category"]["id"]
    if fixture.get("contract_version") != taxonomy["contract_version"]:
        errors.append("fixture contract_version does not match taxonomy")
    if fixture.get("category_id") != category_id:
        errors.append("fixture category_id does not match taxonomy")

    definitions = {item["key"]: item for item in taxonomy["definitions"]}
    models = fixture.get("models")
    if not isinstance(models, list) or len(models) != 5:
        errors.append("fixture must contain exactly five representative models")
        models = []
    model_ids = [model.get("id") for model in models if isinstance(model, dict)]
    for duplicate in sorted(_duplicates(model_ids)):
        errors.append(f"duplicate fixture model id: {duplicate}")

    covered_types: set[str] = set()
    for model in models:
        if not isinstance(model, dict):
            errors.append("every fixture model must be an object")
            continue
        model_id = str(model.get("id", "unknown"))
        if not isinstance(model.get("archetype"), str):
            errors.append(f"{model_id}: archetype is required")
        model_values = model.get("model_values")
        if not isinstance(model_values, dict):
            errors.append(f"{model_id}: model_values must be an object")
            model_values = {}
        _validate_fixture_values(
            definitions, model_values, "model", model_id, errors, covered_types
        )

        variants = model.get("variants")
        if not isinstance(variants, list) or not variants:
            errors.append(f"{model_id}: at least one variant is required")
            variants = []
        default_variants = [
            variant
            for variant in variants
            if isinstance(variant, dict) and variant.get("is_default") is True
        ]
        if len(default_variants) != 1:
            errors.append(f"{model_id}: exactly one default variant is required")
        variant_ids = [
            variant.get("id") for variant in variants if isinstance(variant, dict)
        ]
        for duplicate in sorted(_duplicates(variant_ids)):
            errors.append(f"{model_id}: duplicate variant id {duplicate}")
        for variant in variants:
            if not isinstance(variant, dict):
                errors.append(f"{model_id}: every variant must be an object")
                continue
            values = variant.get("values")
            if not isinstance(values, dict):
                errors.append(f"{model_id}: variant values must be an object")
                continue
            context = f"{model_id}/{variant.get('id', 'unknown')}"
            _validate_fixture_values(
                definitions, values, "variant", context, errors, covered_types
            )

        if default_variants:
            effective = dict(model_values)
            effective.update(default_variants[0].get("values", {}))
            for key, definition in definitions.items():
                if definition["is_required"] and key not in effective:
                    errors.append(f"{model_id}: missing required effective value {key}")

    missing_types = SUPPORTED_VALUE_TYPES - covered_types
    if missing_types:
        errors.append(f"fixture does not cover value types: {sorted(missing_types)}")

    if errors:
        raise TaxonomyValidationError(errors)


def validate_pilot_snapshot(taxonomy: dict[str, Any], snapshot: dict[str, Any]) -> None:
    """Validate a frozen, database-derived category pilot snapshot."""
    validate_taxonomy(taxonomy)
    errors: list[str] = []

    if snapshot.get("contract_version") != taxonomy["contract_version"]:
        errors.append("pilot contract_version does not match taxonomy")
    if snapshot.get("category_id") != taxonomy["category"]["id"]:
        errors.append("pilot category_id does not match taxonomy")

    limit = snapshot.get("limit")
    if limit != 50:
        errors.append("pilot limit must be exactly 50")
    if (
        not isinstance(snapshot.get("selection_rule"), str)
        or not snapshot["selection_rule"].strip()
    ):
        errors.append("pilot selection_rule must be non-empty")
    try:
        generated_at = datetime.fromisoformat(str(snapshot.get("generated_at", "")))
        if generated_at.tzinfo is None:
            errors.append("pilot generated_at must include a timezone")
    except ValueError:
        errors.append("pilot generated_at must be ISO-8601")

    models = snapshot.get("models")
    if not isinstance(models, list) or len(models) != 50:
        errors.append("pilot must contain exactly 50 models")
        models = []

    pilot_keys: list[str] = []
    representative_ids: list[str] = []
    for index, model in enumerate(models, start=1):
        context = f"pilot.models[{index - 1}]"
        if not isinstance(model, dict):
            errors.append(f"{context} must be an object")
            continue
        if model.get("rank") != index:
            errors.append(f"{context}.rank must be {index}")

        brand = model.get("brand")
        family = model.get("model_family")
        if not isinstance(brand, str) or not brand.strip():
            errors.append(f"{context}.brand must be non-empty")
        if not isinstance(family, str) or not family.strip():
            errors.append(f"{context}.model_family must be non-empty")

        pilot_key = model.get("pilot_key")
        if isinstance(pilot_key, str):
            pilot_keys.append(pilot_key)
            if isinstance(brand, str) and isinstance(family, str):
                expected_key = f"{brand.strip().lower()}:{family.strip().lower()}"
                if pilot_key != expected_key:
                    errors.append(f"{context}.pilot_key is not normalized")
        else:
            errors.append(f"{context}.pilot_key must be a string")

        representative_id = model.get("representative_product_id")
        if not isinstance(representative_id, str):
            errors.append(f"{context}.representative_product_id must be a UUID")
        else:
            representative_ids.append(representative_id)
            try:
                UUID(representative_id)
            except ValueError:
                errors.append(f"{context}.representative_product_id must be a UUID")

        for field in ("variant_count", "store_count"):
            value = model.get(field)
            if not isinstance(value, int) or isinstance(value, bool) or value < 0:
                errors.append(f"{context}.{field} must be a non-negative integer")
        lowest_price = model.get("lowest_price_azn")
        if lowest_price is not None and (
            not _is_number(lowest_price) or lowest_price < 0
        ):
            errors.append(f"{context}.lowest_price_azn must be non-negative or null")

    for duplicate in sorted(_duplicates(pilot_keys)):
        errors.append(f"duplicate pilot key: {duplicate}")
    for duplicate in sorted(_duplicates(representative_ids)):
        errors.append(f"duplicate representative product id: {duplicate}")

    if errors:
        raise TaxonomyValidationError(errors)


def validate_comparison_cases(
    taxonomy: dict[str, Any], fixture: dict[str, Any]
) -> None:
    """Validate the behavioral edge-case fixtures required by Phase 0."""
    validate_taxonomy(taxonomy)
    errors: list[str] = []
    required_kinds = {"tie", "missing", "variant_override", "source_conflict"}

    if fixture.get("contract_version") != taxonomy["contract_version"]:
        errors.append("case fixture contract_version does not match taxonomy")
    if fixture.get("category_id") != taxonomy["category"]["id"]:
        errors.append("case fixture category_id does not match taxonomy")
    if fixture.get("fixture_only") is not True:
        errors.append("case fixture must be marked fixture_only")

    definitions = {item["key"]: item for item in taxonomy["definitions"]}
    cases = fixture.get("cases")
    if not isinstance(cases, list):
        errors.append("case fixture cases must be an array")
        cases = []
    case_ids = [case.get("id") for case in cases if isinstance(case, dict)]
    for duplicate in sorted(_duplicates(case_ids)):
        errors.append(f"duplicate comparison case id: {duplicate}")

    found_kinds: set[str] = set()
    for index, case in enumerate(cases):
        context = f"cases[{index}]"
        if not isinstance(case, dict):
            errors.append(f"{context} must be an object")
            continue
        if not isinstance(case.get("id"), str) or not case["id"].strip():
            errors.append(f"{context}.id must be non-empty")
        kind = case.get("kind")
        if kind not in required_kinds:
            errors.append(f"{context}.kind is unsupported")
            continue
        found_kinds.add(kind)
        definition = definitions.get(case.get("definition_key"))
        if definition is None:
            errors.append(f"{context}.definition_key is unknown")
            continue
        inputs = case.get("inputs")
        expected = case.get("expected")
        if not isinstance(inputs, dict) or not isinstance(expected, dict):
            errors.append(f"{context} inputs and expected must be objects")
            continue

        if kind == "tie":
            for side in ("left", "right"):
                _validate_value(
                    definition, inputs.get(side), f"{context}.inputs.{side}", errors
                )
            if expected.get("relation") != "tie":
                errors.append(f"{context} must expect a tie")
        elif kind == "missing":
            present = [value for value in inputs.values() if value is not None]
            if set(inputs) != {"left", "right"} or len(present) != 1:
                errors.append(f"{context} must have exactly one missing side")
            else:
                _validate_value(definition, present[0], f"{context}.present", errors)
            if expected.get("relation") != "insufficient_data":
                errors.append(f"{context} must expect insufficient_data")
        elif kind == "variant_override":
            if definition.get("scope") != "both":
                errors.append(f"{context} override definition must have both scope")
            for level in ("model_value", "variant_value"):
                _validate_value(
                    definition, inputs.get(level), f"{context}.inputs.{level}", errors
                )
            if expected.get("effective_value") != inputs.get("variant_value"):
                errors.append(f"{context} must resolve to the variant value")
        elif kind == "source_conflict":
            observations = inputs.get("observations")
            if not isinstance(observations, list) or len(observations) < 2:
                errors.append(f"{context} needs at least two observations")
                continue
            source_types: list[str] = []
            values: list[Any] = []
            for observation_index, observation in enumerate(observations):
                if not isinstance(observation, dict):
                    errors.append(f"{context}.observations must contain objects")
                    continue
                source_type = observation.get("source_type")
                if not isinstance(source_type, str) or not source_type:
                    errors.append(
                        f"{context}.observations[{observation_index}].source_type is required"
                    )
                else:
                    source_types.append(source_type)
                values.append(observation.get("value"))
                _validate_value(
                    definition,
                    observation.get("value"),
                    f"{context}.observations[{observation_index}].value",
                    errors,
                )
            if len(source_types) != len(set(source_types)):
                errors.append(f"{context} source types must be unique")
            if len({json.dumps(value, sort_keys=True) for value in values}) < 2:
                errors.append(f"{context} observations must disagree")
            if expected.get("blocking_conflict") is not True:
                errors.append(f"{context} must expect a blocking conflict")

    missing_kinds = required_kinds - found_kinds
    if missing_kinds:
        errors.append(f"case fixture does not cover: {sorted(missing_kinds)}")
    if errors:
        raise TaxonomyValidationError(errors)


def _validate_fixture_values(
    definitions: dict[str, dict[str, Any]],
    values: dict[str, Any],
    entity_scope: str,
    context: str,
    errors: list[str],
    covered_types: set[str],
) -> None:
    for key, value in values.items():
        definition = definitions.get(key)
        if definition is None:
            errors.append(f"{context}: unknown definition {key}")
            continue
        if definition["scope"] not in {entity_scope, "both"}:
            errors.append(f"{context}: {key} cannot be stored at {entity_scope} scope")
            continue
        covered_types.add(definition["value_type"])
        _validate_value(definition, value, f"{context}/{key}", errors)


def load_smartphone_contract() -> tuple[dict[str, Any], dict[str, Any]]:
    """Load and validate the bundled smartphone taxonomy and fixtures."""
    taxonomy = load_json(SMARTPHONE_TAXONOMY_PATH)
    fixture = load_json(SMARTPHONE_FIXTURE_PATH)
    validate_fixture(taxonomy, fixture)
    return taxonomy, fixture


def load_smartphone_pilot() -> dict[str, Any]:
    """Load and validate the frozen smartphone pilot snapshot."""
    taxonomy = load_json(SMARTPHONE_TAXONOMY_PATH)
    snapshot = load_json(SMARTPHONE_PILOT_PATH)
    validate_pilot_snapshot(taxonomy, snapshot)
    return snapshot


def load_smartphone_cases() -> dict[str, Any]:
    """Load and validate the comparison behavioral fixtures."""
    taxonomy = load_json(SMARTPHONE_TAXONOMY_PATH)
    fixture = load_json(SMARTPHONE_CASE_FIXTURE_PATH)
    validate_comparison_cases(taxonomy, fixture)
    return fixture


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--taxonomy",
        type=Path,
        default=SMARTPHONE_TAXONOMY_PATH,
        help="Path to the taxonomy JSON file",
    )
    parser.add_argument(
        "--fixture",
        type=Path,
        default=SMARTPHONE_FIXTURE_PATH,
        help="Path to the representative fixture JSON file",
    )
    parser.add_argument(
        "--pilot",
        type=Path,
        default=SMARTPHONE_PILOT_PATH,
        help="Path to the frozen pilot snapshot JSON file",
    )
    parser.add_argument(
        "--cases",
        type=Path,
        default=SMARTPHONE_CASE_FIXTURE_PATH,
        help="Path to behavioral comparison fixture cases",
    )
    args = parser.parse_args()
    taxonomy = load_json(args.taxonomy)
    fixture = load_json(args.fixture)
    pilot = load_json(args.pilot)
    cases = load_json(args.cases)
    validate_fixture(taxonomy, fixture)
    validate_pilot_snapshot(taxonomy, pilot)
    validate_comparison_cases(taxonomy, cases)
    print(
        f"Valid comparison contract: {len(taxonomy['groups'])} groups, "
        f"{len(taxonomy['definitions'])} definitions, "
        f"{len(fixture['models'])} fixtures, "
        f"{len(pilot['models'])} pilot models, "
        f"{len(cases['cases'])} behavioral cases"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

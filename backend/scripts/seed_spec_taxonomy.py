"""Idempotently publish the validated smartphone v1 taxonomy to PostgreSQL."""

from __future__ import annotations

import asyncio
import json
import uuid
from decimal import Decimal

from sqlalchemy import text

from app.core.database import AsyncSessionLocal, engine
from shared.spec_taxonomy import load_json, validate_taxonomy, SMARTPHONE_TAXONOMY_PATH

TAXONOMY_NAMESPACE = uuid.UUID("5370116e-1bb1-4c92-b84e-965dd74277f0")


def stable_id(kind: str, *parts: object) -> uuid.UUID:
    return uuid.uuid5(TAXONOMY_NAMESPACE, ":".join([kind, *(str(p) for p in parts)]))


def json_value(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


async def seed_taxonomy() -> dict[str, int | str]:
    taxonomy = load_json(SMARTPHONE_TAXONOMY_PATH)
    validate_taxonomy(taxonomy)
    version = taxonomy["contract_version"]
    category = taxonomy["category"]

    async with AsyncSessionLocal() as session:
        async with session.begin():
            await session.execute(
                text("""
                    INSERT INTO categories (id, labels, schema_revision, status)
                    VALUES (:id, CAST(:labels AS jsonb), :revision, 'active')
                    ON CONFLICT (id) DO UPDATE SET
                        labels = EXCLUDED.labels,
                        schema_revision = GREATEST(categories.schema_revision, EXCLUDED.schema_revision),
                        status = 'active'
                """),
                {
                    "id": category["id"],
                    "labels": json_value(category["labels"]),
                    "revision": version,
                },
            )

            for unit in taxonomy["units"]:
                await session.execute(
                    text("""
                        INSERT INTO measurement_units
                            (code, dimension, symbols, to_base_multiplier, to_base_offset)
                        VALUES
                            (:code, :dimension, CAST(:symbols AS jsonb), :multiplier, :offset)
                        ON CONFLICT (code) DO NOTHING
                    """),
                    {
                        "code": unit["code"],
                        "dimension": unit["dimension"],
                        "symbols": json_value(unit["symbols"]),
                        "multiplier": Decimal(str(unit["to_base_multiplier"])),
                        "offset": Decimal(str(unit["to_base_offset"])),
                    },
                )
                stored = (
                    await session.execute(
                        text("""
                            SELECT dimension, to_base_multiplier, to_base_offset
                            FROM measurement_units WHERE code = :code
                        """),
                        {"code": unit["code"]},
                    )
                ).one()
                expected = (
                    unit["dimension"],
                    Decimal(str(unit["to_base_multiplier"])),
                    Decimal(str(unit["to_base_offset"])),
                )
                if tuple(stored) != expected:
                    raise RuntimeError(
                        f"Unit {unit['code']} already exists with incompatible semantics"
                    )

            group_ids: dict[str, uuid.UUID] = {}
            for group in taxonomy["groups"]:
                group_id = stable_id("group", category["id"], group["key"])
                actual_id = (
                    await session.execute(
                        text("""
                            INSERT INTO spec_groups
                                (id, category_id, key, labels, sort_order, status)
                            VALUES
                                (:id, :category, :key, CAST(:labels AS jsonb), :sort_order, 'active')
                            ON CONFLICT (category_id, key) DO UPDATE SET
                                labels = EXCLUDED.labels,
                                sort_order = EXCLUDED.sort_order,
                                status = 'active'
                            RETURNING id
                        """),
                        {
                            "id": group_id,
                            "category": category["id"],
                            "key": group["key"],
                            "labels": json_value(group["labels"]),
                            "sort_order": group["sort_order"],
                        },
                    )
                ).scalar_one()
                group_ids[group["key"]] = actual_id

            option_count = 0
            for definition in taxonomy["definitions"]:
                definition_id = stable_id(
                    "definition", category["id"], definition["key"], version
                )
                actual_id = (
                    await session.execute(
                        text("""
                            INSERT INTO spec_definitions (
                                id, category_id, group_id, key, labels, description_labels,
                                scope, value_type, canonical_unit, precision, comparison_rule,
                                absolute_tolerance, relative_tolerance, is_required, is_key,
                                is_filterable, importance_weight, sort_order, freshness_days,
                                schema_version, status
                            ) VALUES (
                                :id, :category, :group_id, :key, CAST(:labels AS jsonb),
                                CAST(:descriptions AS jsonb), :scope, :value_type, :unit,
                                :precision, :comparison_rule, :absolute_tolerance,
                                :relative_tolerance, :is_required, :is_key, :is_filterable,
                                :importance_weight, :sort_order, :freshness_days, :version, 'active'
                            )
                            ON CONFLICT (category_id, key, schema_version) DO UPDATE SET
                                group_id = EXCLUDED.group_id,
                                labels = EXCLUDED.labels,
                                description_labels = EXCLUDED.description_labels,
                                scope = EXCLUDED.scope,
                                value_type = EXCLUDED.value_type,
                                canonical_unit = EXCLUDED.canonical_unit,
                                precision = EXCLUDED.precision,
                                comparison_rule = EXCLUDED.comparison_rule,
                                absolute_tolerance = EXCLUDED.absolute_tolerance,
                                relative_tolerance = EXCLUDED.relative_tolerance,
                                is_required = EXCLUDED.is_required,
                                is_key = EXCLUDED.is_key,
                                is_filterable = EXCLUDED.is_filterable,
                                importance_weight = EXCLUDED.importance_weight,
                                sort_order = EXCLUDED.sort_order,
                                freshness_days = EXCLUDED.freshness_days,
                                status = 'active'
                            RETURNING id
                        """),
                        {
                            "id": definition_id,
                            "category": category["id"],
                            "group_id": group_ids[definition["group"]],
                            "key": definition["key"],
                            "labels": json_value(definition["labels"]),
                            "descriptions": json_value(
                                definition.get("description_labels")
                            ),
                            "scope": definition["scope"],
                            "value_type": definition["value_type"],
                            "unit": definition.get("canonical_unit"),
                            "precision": definition.get("precision", 0),
                            "comparison_rule": definition["comparison_rule"],
                            "absolute_tolerance": Decimal(
                                str(definition.get("absolute_tolerance", 0))
                            ),
                            "relative_tolerance": Decimal(
                                str(definition.get("relative_tolerance", 0))
                            ),
                            "is_required": definition["is_required"],
                            "is_key": definition["is_key"],
                            "is_filterable": definition["is_filterable"],
                            "importance_weight": Decimal(
                                str(definition["importance_weight"])
                            ),
                            "sort_order": definition["sort_order"],
                            "freshness_days": definition["freshness_days"],
                            "version": version,
                        },
                    )
                ).scalar_one()

                for option in definition.get("options", []):
                    option_id = stable_id(
                        "option", category["id"], definition["key"], option["key"]
                    )
                    await session.execute(
                        text("""
                            INSERT INTO spec_options
                                (id, definition_id, key, labels, sort_order, status)
                            VALUES
                                (:id, :definition, :key, CAST(:labels AS jsonb), :sort_order, 'active')
                            ON CONFLICT (definition_id, key) DO UPDATE SET
                                labels = EXCLUDED.labels,
                                sort_order = EXCLUDED.sort_order,
                                status = 'active'
                        """),
                        {
                            "id": option_id,
                            "definition": actual_id,
                            "key": option["key"],
                            "labels": json_value(option["labels"]),
                            "sort_order": option["sort_order"],
                        },
                    )
                    option_count += 1

    return {
        "category": category["id"],
        "units": len(taxonomy["units"]),
        "groups": len(taxonomy["groups"]),
        "definitions": len(taxonomy["definitions"]),
        "options": option_count,
    }


async def main() -> None:
    try:
        print(json.dumps(await seed_taxonomy(), ensure_ascii=False, sort_keys=True))
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())

"""Transactional specification ingestion, moderation, and readiness services."""

from __future__ import annotations

import hashlib
import hmac
import json
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from shared.spec_ingestion import (
    SOURCE_PRIORITIES,
    SpecValueError,
    content_hash,
    idempotency_key,
    normalize_value,
    values_equivalent,
)

VALUE_COLUMNS = (
    "value_number",
    "range_min",
    "range_max",
    "value_boolean",
    "value_text",
    "option_id",
    "value_json",
)


@dataclass(frozen=True)
class ObservationInput:
    definition_key: str
    value: Any
    model_id: UUID | None = None
    product_id: UUID | None = None
    unit: str | None = None
    confidence: Decimal = Decimal("1")
    observed_at: datetime | None = None


@dataclass(frozen=True)
class IngestionResult:
    document_id: UUID
    idempotent: bool
    accepted: int
    rejected: int
    conflicts: int


def _json(value: Any) -> str:
    def encode(item: Any) -> Any:
        if isinstance(item, Decimal):
            return int(item) if item == item.to_integral_value() else float(item)
        return str(item)

    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        default=encode,
    )


def _row_dict(row: Any) -> dict[str, Any]:
    return dict(row._mapping) if row is not None else {}


def _entity(input_value: ObservationInput) -> tuple[str, UUID]:
    if (input_value.model_id is None) == (input_value.product_id is None):
        raise SpecValueError("exactly one model_id or product_id is required")
    if input_value.model_id:
        return "model", input_value.model_id
    return "product", input_value.product_id  # type: ignore[return-value]


async def _definition_bundle(
    db: AsyncSession, key: str, entity_type: str, entity_id: UUID
) -> tuple[dict[str, Any], dict[str, str], dict[str, dict[str, Any]]]:
    target = (
        "SELECT category_id FROM product_models WHERE id=:entity_id"
        if entity_type == "model"
        else """
            SELECT pm.category_id FROM products p
            JOIN product_models pm ON pm.id=p.model_id WHERE p.id=:entity_id
        """
    )
    category = await db.scalar(text(target), {"entity_id": entity_id})
    if not category:
        raise SpecValueError(f"{entity_type} target does not exist or is unmapped")
    definition_row = (
        await db.execute(
            text("""
                SELECT id, category_id, key, scope, value_type, canonical_unit,
                       precision, absolute_tolerance, relative_tolerance,
                       freshness_days, is_required, is_key, importance_weight
                FROM spec_definitions
                WHERE category_id=:category AND key=:key AND status='active'
            """),
            {"category": category, "key": key},
        )
    ).first()
    if not definition_row:
        raise SpecValueError(f"active definition not found: {key}")
    definition = _row_dict(definition_row)
    if entity_type == "model" and definition["scope"] == "variant":
        raise SpecValueError(f"{key} only permits variant values")
    if entity_type == "product" and definition["scope"] == "model":
        raise SpecValueError(f"{key} only permits model values")
    options = {
        str(row.key): str(row.id)
        for row in (
            await db.execute(
                text("""
                    SELECT id, key FROM spec_options
                    WHERE definition_id=:definition_id AND status='active'
                """),
                {"definition_id": definition["id"]},
            )
        ).all()
    }
    units = {str(row.code): _row_dict(row) for row in (await db.execute(text("""
                    SELECT code, dimension, to_base_multiplier, to_base_offset
                    FROM measurement_units
                """))).all()}
    return definition, options, units


async def _audit(
    db: AsyncSession,
    *,
    actor: str,
    action: str,
    entity_type: str,
    entity_id: UUID | str,
    reason: str,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
    source_document_id: UUID | None = None,
    observation_id: UUID | None = None,
) -> None:
    await db.execute(
        text("""
            INSERT INTO spec_audit_events
                (actor, action, entity_type, entity_id, before, after, reason,
                 source_document_id, observation_id)
            VALUES
                (:actor, :action, :entity_type, :entity_id,
                 CAST(:before AS jsonb), CAST(:after AS jsonb), :reason,
                 :source_document_id, :observation_id)
        """),
        {
            "actor": actor,
            "action": action,
            "entity_type": entity_type,
            "entity_id": str(entity_id),
            "before": _json(before) if before is not None else None,
            "after": _json(after) if after is not None else None,
            "reason": reason,
            "source_document_id": source_document_id,
            "observation_id": observation_id,
        },
    )


async def _open_case(
    db: AsyncSession,
    *,
    case_type: str,
    entity_type: str,
    entity_id: UUID,
    definition_id: UUID | None,
    source_document_id: UUID | None,
) -> UUID:
    existing = await db.scalar(
        text("""
            SELECT id FROM spec_moderation_cases
            WHERE case_type=:case_type AND entity_type=:entity_type
              AND entity_id=:entity_id
              AND definition_id IS NOT DISTINCT FROM :definition_id
              AND status IN ('open','assigned')
            ORDER BY created_at LIMIT 1
        """),
        {
            "case_type": case_type,
            "entity_type": entity_type,
            "entity_id": str(entity_id),
            "definition_id": definition_id,
        },
    )
    if existing:
        return existing
    due_hours = 48 if case_type == "conflict" else 72
    return (
        await db.execute(
            text("""
                INSERT INTO spec_moderation_cases
                    (id, case_type, entity_type, entity_id, definition_id,
                     source_document_id, due_at)
                VALUES
                    (:id, :case_type, :entity_type, :entity_id, :definition_id,
                     :source_document_id, :due_at)
                RETURNING id
            """),
            {
                "id": uuid4(),
                "case_type": case_type,
                "entity_type": entity_type,
                "entity_id": str(entity_id),
                "definition_id": definition_id,
                "source_document_id": source_document_id,
                "due_at": datetime.now(timezone.utc) + timedelta(hours=due_hours),
            },
        )
    ).scalar_one()


async def _select_canonical(
    db: AsyncSession,
    *,
    observation_id: UUID,
    actor: str,
    reason: str,
    force: bool = False,
) -> str:
    candidate_row = (
        await db.execute(
            text("""
                SELECT o.*, d.value_type, d.absolute_tolerance, d.relative_tolerance,
                       s.source_type, s.published_at, s.fetched_at
                FROM spec_observations o
                JOIN spec_definitions d ON d.id=o.definition_id
                JOIN source_documents s ON s.id=o.source_document_id
                WHERE o.id=:observation_id
            """),
            {"observation_id": observation_id},
        )
    ).first()
    if not candidate_row:
        raise SpecValueError("observation not found")
    candidate = _row_dict(candidate_row)
    entity_type = "model" if candidate["model_id"] else "product"
    entity_id = candidate["model_id"] or candidate["product_id"]
    lock_key = f"{entity_type}:{entity_id}:{candidate['definition_id']}"
    await db.execute(
        text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"),
        {"key": lock_key},
    )
    current_row = (
        await db.execute(
            text(f"""
                SELECT c.*, o.status AS observation_status, s.source_type,
                       s.published_at, s.fetched_at
                FROM canonical_spec_values c
                JOIN spec_observations o ON o.id=c.selected_observation_id
                JOIN source_documents s ON s.id=o.source_document_id
                WHERE c.definition_id=:definition_id
                  AND c.{entity_type}_id=:entity_id
                FOR UPDATE OF c
            """),
            {
                "definition_id": candidate["definition_id"],
                "entity_id": entity_id,
            },
        )
    ).first()
    current = _row_dict(current_row)
    candidate_values = {column: candidate.get(column) for column in VALUE_COLUMNS}
    equivalent = bool(
        current
        and values_equivalent(
            candidate["value_type"],
            candidate_values,
            current,
            absolute_tolerance=candidate["absolute_tolerance"],
            relative_tolerance=candidate["relative_tolerance"],
        )
    )
    candidate_date = candidate["published_at"] or candidate["fetched_at"]
    current_date = (
        (current.get("published_at") or current.get("fetched_at")) if current else None
    )
    candidate_rank = SOURCE_PRIORITIES[candidate["source_type"]]
    current_rank = SOURCE_PRIORITIES.get(current.get("source_type"), 0)
    outranks = candidate_rank > current_rank or (
        candidate_rank == current_rank
        and (current_date is None or candidate_date > current_date)
    )

    if (
        current
        and not force
        and current["source_type"] == "manual"
        and candidate["source_type"] != "manual"
    ):
        await db.execute(
            text("UPDATE spec_observations SET status='conflict' WHERE id=:id"),
            {"id": observation_id},
        )
        await _open_case(
            db,
            case_type="conflict",
            entity_type=entity_type,
            entity_id=entity_id,
            definition_id=candidate["definition_id"],
            source_document_id=candidate["source_document_id"],
        )
        return "conflict"

    should_replace = force or not current or outranks
    if current and equivalent and not should_replace:
        await db.execute(
            text("UPDATE spec_observations SET status='rejected' WHERE id=:id"),
            {"id": observation_id},
        )
        return "rejected"
    if current and not equivalent and not should_replace:
        await db.execute(
            text("UPDATE spec_observations SET status='conflict' WHERE id=:id"),
            {"id": observation_id},
        )
        await _open_case(
            db,
            case_type="conflict",
            entity_type=entity_type,
            entity_id=entity_id,
            definition_id=candidate["definition_id"],
            source_document_id=candidate["source_document_id"],
        )
        return "conflict"

    if current:
        await db.execute(
            text("""
                UPDATE spec_observations SET status='superseded'
                WHERE id=:id AND id<>:candidate_id
            """),
            {"id": current["selected_observation_id"], "candidate_id": observation_id},
        )
    await db.execute(
        text("UPDATE spec_observations SET status='accepted' WHERE id=:id"),
        {"id": observation_id},
    )
    parameters = {
        "id": current.get("id") or uuid4(),
        "definition_id": candidate["definition_id"],
        "observation_id": observation_id,
        "model_id": candidate["model_id"],
        "product_id": candidate["product_id"],
        "value_number": candidate["value_number"],
        "range_min": candidate["range_min"],
        "range_max": candidate["range_max"],
        "value_boolean": candidate["value_boolean"],
        "value_text": candidate["value_text"],
        "option_id": candidate["option_id"],
        "value_json": (
            _json(candidate["value_json"])
            if candidate["value_json"] is not None
            else None
        ),
        "verified_at": candidate["observed_at"],
        "actor": actor,
    }
    if current:
        await db.execute(
            text("""
                UPDATE canonical_spec_values SET
                    selected_observation_id=:observation_id,
                    value_number=:value_number, range_min=:range_min,
                    range_max=:range_max, value_boolean=:value_boolean,
                    value_text=:value_text, option_id=:option_id,
                    value_json=CAST(:value_json AS jsonb), verified_at=:verified_at,
                    updated_by=:actor
                WHERE id=:id
            """),
            parameters,
        )
    else:
        await db.execute(
            text("""
                INSERT INTO canonical_spec_values
                    (id, definition_id, selected_observation_id, model_id, product_id,
                     value_number, range_min, range_max, value_boolean, value_text,
                     option_id, value_json, verified_at, updated_by)
                VALUES
                    (:id, :definition_id, :observation_id, :model_id, :product_id,
                     :value_number, :range_min, :range_max, :value_boolean, :value_text,
                     :option_id, CAST(:value_json AS jsonb), :verified_at, :actor)
            """),
            parameters,
        )
    await _audit(
        db,
        actor=actor,
        action="canonical.select",
        entity_type=entity_type,
        entity_id=entity_id,
        before=current or None,
        after={"observation_id": str(observation_id), **candidate_values},
        reason=reason,
        source_document_id=candidate["source_document_id"],
        observation_id=observation_id,
    )
    return "accepted"


async def ingest_document(
    db: AsyncSession,
    *,
    source_type: str,
    source_url: str,
    parser_name: str,
    parser_version: str,
    raw_payload: dict[str, Any],
    observations: list[ObservationInput],
    actor: str,
    reason: str,
    fetched_at: datetime | None = None,
    published_at: datetime | None = None,
    manufacturer_domain: str | None = None,
) -> IngestionResult:
    if source_type not in SOURCE_PRIORITIES:
        raise SpecValueError("unsupported source type")
    fetched_at = fetched_at or datetime.now(timezone.utc)
    key = idempotency_key(
        source_type=source_type,
        source_url=source_url,
        parser_name=parser_name,
        parser_version=parser_version,
        payload=raw_payload,
    )
    existing = (
        await db.execute(
            text(
                "SELECT id, parse_status FROM source_documents WHERE idempotency_key=:key"
            ),
            {"key": key},
        )
    ).first()
    if existing and existing.parse_status == "parsed":
        return IngestionResult(existing.id, True, 0, 0, 0)
    document_id = existing.id if existing else uuid4()
    if not existing:
        inserted_id = (
            await db.execute(
                text("""
                    INSERT INTO source_documents
                        (id, source_type, source_url, manufacturer_domain, fetched_at,
                         published_at, content_hash, parser_name, parser_version,
                         raw_payload, idempotency_key)
                    VALUES
                        (:id, :source_type, :source_url, :manufacturer_domain, :fetched_at,
                         :published_at, :content_hash, :parser_name, :parser_version,
                         CAST(:raw_payload AS jsonb), :idempotency_key)
                    ON CONFLICT (idempotency_key) DO NOTHING
                    RETURNING id
                """),
                {
                    "id": document_id,
                    "source_type": source_type,
                    "source_url": source_url,
                    "manufacturer_domain": manufacturer_domain,
                    "fetched_at": fetched_at,
                    "published_at": published_at,
                    "content_hash": content_hash(raw_payload),
                    "parser_name": parser_name,
                    "parser_version": parser_version,
                    "raw_payload": _json(raw_payload),
                    "idempotency_key": key,
                },
            )
        ).scalar_one_or_none()
        if inserted_id is None:
            concurrent = (
                await db.execute(
                    text("""
                        SELECT id, parse_status FROM source_documents
                        WHERE idempotency_key=:key
                    """),
                    {"key": key},
                )
            ).one()
            document_id = concurrent.id
            if concurrent.parse_status == "parsed":
                return IngestionResult(document_id, True, 0, 0, 0)
    counts = {"accepted": 0, "rejected": 0, "conflict": 0}
    for item in observations:
        entity_type, entity_id = _entity(item)
        definition, options, units = await _definition_bundle(
            db, item.definition_key, entity_type, entity_id
        )
        normalized = normalize_value(
            definition,
            item.value,
            original_unit=item.unit,
            units=units,
            options=options,
        )
        observation_id = (
            await db.execute(
                text("""
                    INSERT INTO spec_observations
                        (id, source_document_id, definition_id, model_id, product_id,
                         original_value, original_unit, value_number, range_min, range_max,
                         value_boolean, value_text, option_id, value_json, confidence,
                         observed_at, created_by)
                    VALUES
                        (:id, :source_document_id, :definition_id, :model_id, :product_id,
                         :original_value, :original_unit, :value_number, :range_min,
                         :range_max, :value_boolean, :value_text, :option_id,
                         CAST(:value_json AS jsonb), :confidence, :observed_at, :actor)
                    ON CONFLICT DO NOTHING RETURNING id
                """),
                {
                    "id": uuid4(),
                    "source_document_id": document_id,
                    "definition_id": definition["id"],
                    "model_id": item.model_id,
                    "product_id": item.product_id,
                    "original_value": _json(item.value),
                    "original_unit": item.unit,
                    **{
                        key: (
                            _json(value)
                            if key == "value_json" and value is not None
                            else value
                        )
                        for key, value in normalized.items()
                    },
                    "confidence": item.confidence,
                    "observed_at": item.observed_at or fetched_at,
                    "actor": actor,
                },
            )
        ).scalar_one_or_none()
        if observation_id is None:
            continue
        status = await _select_canonical(
            db,
            observation_id=observation_id,
            actor=actor,
            reason=reason,
        )
        counts[status] += 1
    await db.execute(
        text("""
            UPDATE source_documents SET parse_status='parsed', parse_error=NULL
            WHERE id=:id
        """),
        {"id": document_id},
    )
    return IngestionResult(
        document_id=document_id,
        idempotent=False,
        accepted=counts["accepted"],
        rejected=counts["rejected"],
        conflicts=counts["conflict"],
    )


async def resolve_case(
    db: AsyncSession,
    *,
    case_id: UUID,
    action: str,
    reason: str,
    actor: str,
    observation_id: UUID | None = None,
) -> dict[str, Any]:
    case_row = (
        await db.execute(
            text("SELECT * FROM spec_moderation_cases WHERE id=:id FOR UPDATE"),
            {"id": case_id},
        )
    ).first()
    if not case_row:
        raise SpecValueError("moderation case not found")
    case = _row_dict(case_row)
    if case["status"] not in {"open", "assigned"}:
        raise SpecValueError("moderation case is already closed")
    if action == "accept":
        if not observation_id:
            raise SpecValueError("accept requires observation_id")
        await _select_canonical(
            db,
            observation_id=observation_id,
            actor=actor,
            reason=reason,
            force=True,
        )
        new_status = "resolved"
    elif action == "reject":
        if not observation_id:
            raise SpecValueError("reject requires observation_id")
        await db.execute(
            text("UPDATE spec_observations SET status='rejected' WHERE id=:id"),
            {"id": observation_id},
        )
        new_status = "resolved"
    elif action == "dismiss":
        new_status = "dismissed"
    else:
        raise SpecValueError("unsupported moderation action")
    await db.execute(
        text("""
            UPDATE spec_moderation_cases
            SET status=:status, resolution=:reason, assignee=:actor, resolved_at=NOW()
            WHERE id=:id
        """),
        {"status": new_status, "reason": reason, "actor": actor, "id": case_id},
    )
    await _audit(
        db,
        actor=actor,
        action=f"moderation.{action}",
        entity_type="spec_moderation_case",
        entity_id=case_id,
        before=case,
        after={"status": new_status, "observation_id": str(observation_id or "")},
        reason=reason,
        observation_id=observation_id,
    )
    return {"id": case_id, "status": new_status}


async def calculate_model_readiness(
    db: AsyncSession, model_id: UUID, *, persist: bool = True
) -> dict[str, Any]:
    model_row = (
        await db.execute(
            text("""
                SELECT pm.*, c.status AS category_status, c.labels AS category_labels
                FROM product_models pm JOIN categories c ON c.id=pm.category_id
                WHERE pm.id=:id
            """),
            {"id": model_id},
        )
    ).first()
    if not model_row:
        raise SpecValueError("model not found")
    model = _row_dict(model_row)
    definitions = (
        await db.execute(
            text("""
                SELECT id, key, scope, is_required, is_key, importance_weight,
                       freshness_days
                FROM spec_definitions
                WHERE category_id=:category AND status='active'
                ORDER BY key
            """),
            {"category": model["category_id"]},
        )
    ).all()
    default_product_id = await db.scalar(
        text("""
            SELECT id FROM products WHERE model_id=:model_id
            ORDER BY is_default_variant DESC, canonical_id LIMIT 1
        """),
        {"model_id": model_id},
    )
    values = (
        await db.execute(
            text("""
                SELECT definition_id, model_id, product_id, verified_at
                FROM canonical_spec_values
                WHERE model_id=:model_id OR product_id=:product_id
            """),
            {"model_id": model_id, "product_id": default_product_id},
        )
    ).all()
    model_values = {row.definition_id: row for row in values if row.model_id}
    variant_values = {row.definition_id: row for row in values if row.product_id}
    now = datetime.now(timezone.utc)
    required_missing: list[str] = []
    stale: list[str] = []
    key_total = Decimal("0")
    key_present = Decimal("0")
    for definition in definitions:
        value = variant_values.get(definition.id) or model_values.get(definition.id)
        fresh = bool(
            value
            and value.verified_at + timedelta(days=definition.freshness_days) > now
        )
        if definition.is_key:
            weight = Decimal(definition.importance_weight)
            key_total += weight
            if fresh:
                key_present += weight
        if definition.is_required and not fresh:
            required_missing.append(definition.key)
        if value and not fresh:
            stale.append(definition.key)
    score = (
        (key_present / key_total * 100).quantize(Decimal("0.01"))
        if key_total
        else Decimal("0")
    )
    open_conflicts = int(
        await db.scalar(
            text("""
                SELECT COUNT(*) FROM spec_moderation_cases
                WHERE status IN ('open','assigned') AND case_type='conflict'
                  AND entity_type='model' AND entity_id=:model_id
            """),
            {"model_id": str(model_id)},
        )
        or 0
    )
    unresolved_mappings = int(
        await db.scalar(
            text("""
                SELECT COUNT(*) FROM model_mapping_reviews r
                JOIN products p ON p.id=r.product_id
                WHERE r.status='pending' AND p.model_id=:model_id
            """),
            {"model_id": model_id},
        )
        or 0
    )
    labels = model["category_labels"] or {}
    ready = bool(
        model["status"] == "verified"
        and model["category_status"] == "active"
        and labels.get("az")
        and labels.get("ru")
        and not required_missing
        and score >= 90
        and not open_conflicts
        and not unresolved_mappings
    )
    result = {
        "model_id": model_id,
        "readiness_score": score,
        "is_comparison_ready": ready,
        "required_missing": required_missing,
        "stale_keys": stale,
        "open_conflicts": open_conflicts,
        "unresolved_mappings": unresolved_mappings,
        "key_present_weight": key_present,
        "key_total_weight": key_total,
    }
    if persist:
        await db.execute(
            text("""
                UPDATE product_models SET readiness_score=:score,
                    is_comparison_ready=:ready,
                    last_verified_at=CASE WHEN :ready THEN NOW() ELSE last_verified_at END,
                    updated_at=NOW()
                WHERE id=:model_id
            """),
            {"score": score, "ready": ready, "model_id": model_id},
        )
        await db.execute(
            text("DELETE FROM spec_readiness_queue WHERE model_id=:model_id"),
            {"model_id": model_id},
        )
    return result


def make_import_token(rows: list[dict[str, Any]], secret: str, now: datetime) -> str:
    expires = int((now + timedelta(minutes=30)).timestamp())
    digest = content_hash(rows)
    payload = f"{expires}.{digest}"
    signature = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}.{signature}"


def verify_import_token(
    token: str, rows: list[dict[str, Any]], secret: str, now: datetime
) -> None:
    try:
        expires_text, digest, signature = token.split(".", 2)
        payload = f"{expires_text}.{digest}"
        valid = hmac.compare_digest(
            signature,
            hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest(),
        )
        if (
            not valid
            or int(expires_text) < int(now.timestamp())
            or not hmac.compare_digest(digest, content_hash(rows))
        ):
            raise ValueError
    except (ValueError, TypeError) as exc:
        raise SpecValueError(
            "import token is invalid, expired, or payload changed"
        ) from exc


async def validate_import_rows(
    db: AsyncSession, rows: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    if not rows or len(rows) > 5000:
        raise SpecValueError("import must contain 1 to 5000 rows")
    validated: list[dict[str, Any]] = []
    for index, row in enumerate(rows):
        try:
            item = ObservationInput(
                definition_key=str(row["definition_key"]),
                value=row["value"],
                model_id=UUID(row["model_id"]) if row.get("model_id") else None,
                product_id=UUID(row["product_id"]) if row.get("product_id") else None,
                unit=row.get("unit"),
            )
            entity_type, entity_id = _entity(item)
            definition, options, units = await _definition_bundle(
                db, item.definition_key, entity_type, entity_id
            )
            normalized = normalize_value(
                definition,
                item.value,
                original_unit=item.unit,
                units=units,
                options=options,
            )
            validated.append(
                {
                    "row": index + 1,
                    "entity_type": entity_type,
                    "entity_id": str(entity_id),
                    "definition_key": item.definition_key,
                    "normalized": {
                        key: str(value) if isinstance(value, Decimal) else value
                        for key, value in normalized.items()
                        if value is not None
                    },
                }
            )
        except (KeyError, ValueError, SpecValueError) as exc:
            raise SpecValueError(f"row {index + 1}: {exc}") from exc
    return validated


async def commit_import_rows(
    db: AsyncSession,
    rows: list[dict[str, Any]],
    *,
    actor: str,
    reason: str,
) -> dict[str, Any]:
    accepted = rejected = conflicts = 0
    for row in rows:
        item = ObservationInput(
            definition_key=str(row["definition_key"]),
            value=row["value"],
            model_id=UUID(row["model_id"]) if row.get("model_id") else None,
            product_id=UUID(row["product_id"]) if row.get("product_id") else None,
            unit=row.get("unit"),
        )
        document_id = uuid4()
        result = await ingest_document(
            db,
            source_type="manual",
            source_url=f"admin://spec/{document_id}",
            parser_name="admin-bulk-import",
            parser_version="1",
            raw_payload=row,
            observations=[item],
            actor=actor,
            reason=reason,
        )
        accepted += result.accepted
        rejected += result.rejected
        conflicts += result.conflicts
    return {
        "rows": len(rows),
        "accepted": accepted,
        "rejected": rejected,
        "conflicts": conflicts,
    }


def ingestion_result_dict(result: IngestionResult) -> dict[str, Any]:
    return asdict(result)

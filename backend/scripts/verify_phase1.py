"""Read-only/rollback verification for the Phase 1 PostgreSQL contract."""

from __future__ import annotations

import json

import psycopg
from psycopg import errors

from app.core.config import get_settings


def expect_constraint(cursor: psycopg.Cursor, statement: str) -> None:
    cursor.execute("SAVEPOINT expected_constraint")
    try:
        cursor.execute(statement)
    except (errors.CheckViolation, errors.UniqueViolation, errors.RaiseException):
        cursor.execute("ROLLBACK TO SAVEPOINT expected_constraint")
    else:
        raise AssertionError(f"Expected a database constraint to reject: {statement}")


def main() -> int:
    settings = get_settings()
    results: dict[str, object] = {}
    connection_url = settings.SYNC_DATABASE_URL.replace(
        "postgresql+psycopg://", "postgresql://", 1
    )
    with psycopg.connect(connection_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT version_num FROM alembic_version")
            revision = cursor.fetchone()[0]
            assert revision == "20260722_0003"
            results["revision"] = revision

            cursor.execute("""
                SELECT
                    (SELECT count(*) FROM measurement_units),
                    (SELECT count(*) FROM spec_groups WHERE category_id='smartphones'),
                    (SELECT count(*) FROM spec_definitions
                     WHERE category_id='smartphones' AND status='active'),
                    (SELECT count(*) FROM spec_options WHERE status='active')
            """)
            taxonomy_counts = cursor.fetchone()
            assert taxonomy_counts == (19, 15, 66, 42)
            results["taxonomy"] = taxonomy_counts

            cursor.execute("""
                SELECT count(*) FILTER (WHERE model_id IS NULL), count(*)
                FROM products
            """)
            unmapped, product_count = cursor.fetchone()
            assert unmapped == 0
            results["products"] = product_count

            cursor.execute("""
                SELECT count(*) FROM (
                    SELECT pm.id
                    FROM product_models pm
                    LEFT JOIN products p ON p.model_id=pm.id
                    GROUP BY pm.id
                    HAVING count(p.id) > 0
                       AND count(*) FILTER (WHERE p.is_default_variant) <> 1
                ) anomalies
            """)
            assert cursor.fetchone()[0] == 0

            cursor.execute("SELECT product_id FROM current_prices LIMIT 1")
            product_id = cursor.fetchone()[0]
            cursor.execute(
                "SELECT price_revision FROM products WHERE id=%s", (product_id,)
            )
            revision_before = cursor.fetchone()[0]
            cursor.execute(
                "UPDATE current_prices SET last_checked_at=last_checked_at WHERE product_id=%s",
                (product_id,),
            )
            updated_prices = cursor.rowcount
            cursor.execute(
                "SELECT price_revision FROM products WHERE id=%s", (product_id,)
            )
            assert cursor.fetchone()[0] == revision_before + updated_prices
            results["price_revision_trigger"] = "ok"

            cursor.execute("""
                SELECT pm.id, d.id
                FROM product_models pm
                JOIN spec_definitions d ON d.category_id = pm.category_id
                WHERE d.status = 'active' AND d.value_type = 'number'
                  AND d.scope IN ('model','both')
                LIMIT 1
            """)
            model_id, definition_id = cursor.fetchone()
            cursor.execute(
                "SELECT spec_revision FROM product_models WHERE id=%s", (model_id,)
            )
            spec_revision_before = cursor.fetchone()[0]
            cursor.execute("""
                INSERT INTO source_documents
                    (source_type,source_url,fetched_at,content_hash,parser_name,
                     parser_version,raw_payload,parse_status,idempotency_key)
                VALUES
                    ('official','https://example.invalid/phase1',now(),repeat('a',64),
                     'phase1-verifier','1','{}'::jsonb,'parsed',repeat('b',64))
                RETURNING id
            """)
            document_id = cursor.fetchone()[0]
            cursor.execute(
                """
                INSERT INTO spec_observations
                    (source_document_id,definition_id,model_id,original_value,
                     value_number,confidence,status,observed_at,created_by)
                VALUES (%s,%s,%s,'1',1,1,'accepted',now(),'phase1-verifier')
                RETURNING id
            """,
                (document_id, definition_id, model_id),
            )
            observation_id = cursor.fetchone()[0]
            cursor.execute(
                """
                INSERT INTO canonical_spec_values
                    (definition_id,selected_observation_id,model_id,value_number,
                     verified_at,updated_by)
                VALUES (%s,%s,%s,1,now(),'phase1-verifier')
                RETURNING id
            """,
                (definition_id, observation_id, model_id),
            )
            canonical_id = cursor.fetchone()[0]
            cursor.execute("SET CONSTRAINTS ALL IMMEDIATE")
            cursor.execute(
                "SELECT spec_revision FROM product_models WHERE id=%s", (model_id,)
            )
            assert cursor.fetchone()[0] == spec_revision_before + 1
            cursor.execute(
                "UPDATE canonical_spec_values SET value_number=2 WHERE id=%s RETURNING revision",
                (canonical_id,),
            )
            assert cursor.fetchone()[0] == 2
            cursor.execute(
                "DELETE FROM canonical_spec_values WHERE id=%s", (canonical_id,)
            )
            cursor.execute(
                "SELECT spec_revision FROM product_models WHERE id=%s", (model_id,)
            )
            assert cursor.fetchone()[0] == spec_revision_before + 3
            results["canonical_revision_triggers"] = "ok"

            expect_constraint(
                cursor,
                """INSERT INTO categories (id, labels) VALUES
                   ('invalid-label-test', '{"az":"Only one"}'::jsonb)""",
            )
            expect_constraint(
                cursor,
                """INSERT INTO spec_definitions
                   (category_id,group_id,key,labels,scope,value_type,comparison_rule,
                    is_required,is_key,is_filterable,importance_weight,sort_order,
                    freshness_days,schema_version,status)
                   SELECT 'smartphones',id,'invalid.rule.test',
                          '{"az":"X","ru":"X"}'::jsonb,'model','text','higher_better',
                          false,false,false,1,999,180,1,'draft'
                   FROM spec_groups WHERE category_id='smartphones' LIMIT 1""",
            )
            cursor.execute("SELECT id FROM product_models LIMIT 1")
            model_id = cursor.fetchone()[0]
            expect_constraint(
                cursor,
                f"UPDATE product_models SET slug=slug || '-changed' WHERE id='{model_id}'",
            )

            cursor.execute("""
                INSERT INTO spec_audit_events
                    (actor,action,entity_type,entity_id,reason)
                VALUES ('phase1-verifier','verify','phase1','rollback-test','transaction rollback')
                RETURNING id
            """)
            audit_id = cursor.fetchone()[0]
            expect_constraint(
                cursor,
                f"UPDATE spec_audit_events SET reason='mutated' WHERE id={audit_id}",
            )
            results["invariant_constraints"] = "ok"

        connection.rollback()

    print(json.dumps(results, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

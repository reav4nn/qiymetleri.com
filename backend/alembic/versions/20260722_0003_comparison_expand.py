"""Expand the schema for canonical models and typed comparison specifications.

Revision ID: 20260722_0003
Revises: 20260719_0002
Create Date: 2026-07-22
"""

from alembic import op

revision = "20260722_0003"
down_revision = "20260719_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # The migration is deliberately PostgreSQL-native: its constraints and
    # triggers are part of the comparison data contract, not application-only
    # validation.
    op.execute(
        r"""
        CREATE TABLE categories (
            id varchar(100) PRIMARY KEY,
            labels jsonb NOT NULL,
            schema_revision bigint NOT NULL DEFAULT 1,
            status varchar(20) NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','active','archived')),
            CONSTRAINT ck_categories_labels CHECK (
                jsonb_typeof(labels) = 'object'
                AND labels ?& ARRAY['az','ru']
                AND (labels - 'az' - 'ru') = '{}'::jsonb
                AND jsonb_typeof(labels->'az') = 'string'
                AND jsonb_typeof(labels->'ru') = 'string'
                AND length(btrim(labels->>'az')) > 0
                AND length(btrim(labels->>'ru')) > 0
            )
        );

        INSERT INTO categories (id, labels, status)
        SELECT DISTINCT lower(btrim(category)),
               jsonb_build_object('az', initcap(btrim(category)), 'ru', initcap(btrim(category))),
               CASE WHEN lower(btrim(category)) = 'smartphones' THEN 'active' ELSE 'draft' END
        FROM products
        WHERE category IS NOT NULL AND length(btrim(category)) > 0;

        INSERT INTO categories (id, labels, status)
        VALUES ('smartphones', '{"az":"Smartfonlar","ru":"Смартфоны"}'::jsonb, 'active')
        ON CONFLICT (id) DO UPDATE
        SET labels = EXCLUDED.labels, status = EXCLUDED.status;

        CREATE TABLE product_models (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            category_id varchar(100) NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
            brand varchar(100) NOT NULL,
            name varchar(300) NOT NULL,
            slug varchar(320) NOT NULL,
            status varchar(20) NOT NULL DEFAULT 'provisional'
                CHECK (status IN ('provisional','verified','archived')),
            spec_revision bigint NOT NULL DEFAULT 1,
            readiness_score numeric(5,2) NOT NULL DEFAULT 0
                CHECK (readiness_score BETWEEN 0 AND 100),
            is_comparison_ready boolean NOT NULL DEFAULT false,
            last_verified_at timestamptz,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            search_vector tsvector GENERATED ALWAYS AS (
                setweight(to_tsvector('simple', coalesce(brand, '')), 'A') ||
                setweight(to_tsvector('simple', coalesce(name, '')), 'B')
            ) STORED,
            CONSTRAINT ck_product_models_slug CHECK (
                slug = lower(slug) AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
            )
        );
        CREATE UNIQUE INDEX uq_product_models_slug_lower ON product_models (lower(slug));
        CREATE INDEX idx_product_models_category_status ON product_models (category_id, status);
        CREATE INDEX idx_product_models_search ON product_models USING gin (search_vector);
        CREATE INDEX idx_product_models_name_trgm ON product_models USING gin (name gin_trgm_ops);
        CREATE INDEX idx_product_models_brand_trgm ON product_models USING gin (brand gin_trgm_ops);

        CREATE TABLE product_model_slug_aliases (
            alias varchar(320) PRIMARY KEY,
            model_id uuid NOT NULL REFERENCES product_models(id) ON DELETE CASCADE,
            created_at timestamptz NOT NULL DEFAULT now(),
            reason text NOT NULL,
            created_by varchar(200) NOT NULL,
            CONSTRAINT ck_product_model_alias_slug CHECK (
                alias = lower(alias) AND alias ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
            )
        );
        CREATE UNIQUE INDEX uq_product_model_alias_lower
            ON product_model_slug_aliases (lower(alias));

        ALTER TABLE products
            ADD COLUMN model_id uuid REFERENCES product_models(id) ON DELETE RESTRICT,
            ADD COLUMN is_default_variant boolean NOT NULL DEFAULT false,
            ADD COLUMN price_revision bigint NOT NULL DEFAULT 1;
        CREATE INDEX idx_products_model_id ON products (model_id);
        CREATE UNIQUE INDEX uq_products_one_default_variant
            ON products (model_id) WHERE is_default_variant;

        CREATE TABLE measurement_units (
            code varchar(30) PRIMARY KEY,
            dimension varchar(50) NOT NULL,
            symbols jsonb NOT NULL,
            to_base_multiplier numeric(24,12) NOT NULL,
            to_base_offset numeric(24,12) NOT NULL,
            CONSTRAINT ck_measurement_units_symbols CHECK (
                jsonb_typeof(symbols) = 'object'
                AND symbols ?& ARRAY['az','ru']
                AND jsonb_typeof(symbols->'az') = 'string'
                AND jsonb_typeof(symbols->'ru') = 'string'
            )
        );

        CREATE TABLE spec_groups (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            category_id varchar(100) NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
            key varchar(100) NOT NULL,
            labels jsonb NOT NULL,
            sort_order smallint NOT NULL,
            status varchar(20) NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','active','archived')),
            UNIQUE (category_id, key),
            UNIQUE (category_id, sort_order),
            UNIQUE (id, category_id),
            CONSTRAINT ck_spec_groups_labels CHECK (
                jsonb_typeof(labels) = 'object'
                AND labels ?& ARRAY['az','ru']
                AND jsonb_typeof(labels->'az') = 'string'
                AND jsonb_typeof(labels->'ru') = 'string'
                AND length(btrim(labels->>'az')) > 0
                AND length(btrim(labels->>'ru')) > 0
            )
        );

        CREATE TABLE spec_definitions (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            category_id varchar(100) NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
            group_id uuid NOT NULL,
            key varchar(160) NOT NULL,
            labels jsonb NOT NULL,
            description_labels jsonb,
            scope varchar(20) NOT NULL CHECK (scope IN ('model','variant','both')),
            value_type varchar(20) NOT NULL CHECK (
                value_type IN ('number','number_range','boolean','text','enum','number_list','option_set')
            ),
            canonical_unit varchar(30) REFERENCES measurement_units(code) ON DELETE RESTRICT,
            precision smallint NOT NULL DEFAULT 0 CHECK (precision BETWEEN 0 AND 8),
            comparison_rule varchar(30) NOT NULL CHECK (
                comparison_rule IN ('higher_better','lower_better','true_better','false_better','difference_only')
            ),
            absolute_tolerance numeric(24,8) NOT NULL DEFAULT 0 CHECK (absolute_tolerance >= 0),
            relative_tolerance numeric(12,8) NOT NULL DEFAULT 0 CHECK (relative_tolerance >= 0),
            is_required boolean NOT NULL DEFAULT false,
            is_key boolean NOT NULL DEFAULT false,
            is_filterable boolean NOT NULL DEFAULT false,
            importance_weight numeric(8,3) NOT NULL CHECK (importance_weight > 0),
            sort_order smallint NOT NULL,
            freshness_days integer NOT NULL DEFAULT 180 CHECK (freshness_days > 0),
            schema_version integer NOT NULL CHECK (schema_version > 0),
            status varchar(20) NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','active','deprecated')),
            replaced_by_id uuid REFERENCES spec_definitions(id) ON DELETE RESTRICT,
            FOREIGN KEY (group_id, category_id)
                REFERENCES spec_groups(id, category_id) ON DELETE RESTRICT,
            UNIQUE (category_id, key, schema_version),
            CONSTRAINT ck_spec_definitions_labels CHECK (
                jsonb_typeof(labels) = 'object'
                AND labels ?& ARRAY['az','ru']
                AND jsonb_typeof(labels->'az') = 'string'
                AND jsonb_typeof(labels->'ru') = 'string'
                AND length(btrim(labels->>'az')) > 0
                AND length(btrim(labels->>'ru')) > 0
            ),
            CONSTRAINT ck_spec_definitions_rule_type CHECK (
                (comparison_rule NOT IN ('higher_better','lower_better') OR value_type = 'number')
                AND (comparison_rule NOT IN ('true_better','false_better') OR value_type = 'boolean')
                AND (value_type NOT IN ('text','enum','number_range','number_list','option_set')
                     OR comparison_rule = 'difference_only')
            ),
            CONSTRAINT ck_spec_definitions_unit_type CHECK (
                value_type IN ('number','number_range','number_list') OR canonical_unit IS NULL
            )
        );
        CREATE UNIQUE INDEX uq_spec_definitions_one_active_key
            ON spec_definitions (category_id, key) WHERE status = 'active';
        CREATE INDEX idx_spec_definitions_category_display
            ON spec_definitions (category_id, group_id, sort_order) WHERE status = 'active';

        CREATE TABLE spec_options (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            definition_id uuid NOT NULL REFERENCES spec_definitions(id) ON DELETE RESTRICT,
            key varchar(100) NOT NULL,
            labels jsonb NOT NULL,
            sort_order smallint NOT NULL,
            status varchar(20) NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','deprecated')),
            UNIQUE (definition_id, key),
            UNIQUE (definition_id, sort_order),
            CONSTRAINT ck_spec_options_labels CHECK (
                jsonb_typeof(labels) = 'object'
                AND labels ?& ARRAY['az','ru']
                AND jsonb_typeof(labels->'az') = 'string'
                AND jsonb_typeof(labels->'ru') = 'string'
                AND length(btrim(labels->>'az')) > 0
                AND length(btrim(labels->>'ru')) > 0
            )
        );

        CREATE TABLE source_documents (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            source_type varchar(20) NOT NULL CHECK (source_type IN ('official','retailer','manual')),
            source_url text NOT NULL,
            manufacturer_domain varchar(255),
            fetched_at timestamptz NOT NULL,
            published_at timestamptz,
            content_hash char(64) NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
            parser_name varchar(100) NOT NULL,
            parser_version varchar(50) NOT NULL,
            raw_payload jsonb NOT NULL,
            parse_status varchar(20) NOT NULL DEFAULT 'pending'
                CHECK (parse_status IN ('pending','parsed','failed','tombstoned')),
            parse_error text,
            idempotency_key char(64) NOT NULL UNIQUE
                CHECK (idempotency_key ~ '^[0-9a-f]{64}$'),
            tombstoned_at timestamptz,
            CONSTRAINT ck_source_document_manual_url CHECK (
                source_type <> 'manual' OR source_url ~ '^admin://spec/[0-9a-f-]+$'
            )
        );

        CREATE TABLE spec_observations (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            source_document_id uuid NOT NULL REFERENCES source_documents(id) ON DELETE RESTRICT,
            definition_id uuid NOT NULL REFERENCES spec_definitions(id) ON DELETE RESTRICT,
            model_id uuid REFERENCES product_models(id) ON DELETE RESTRICT,
            product_id uuid REFERENCES products(id) ON DELETE RESTRICT,
            original_value text NOT NULL,
            original_unit varchar(30),
            value_number numeric(24,8),
            range_min numeric(24,8),
            range_max numeric(24,8),
            value_boolean boolean,
            value_text text,
            option_id uuid REFERENCES spec_options(id) ON DELETE RESTRICT,
            value_json jsonb,
            confidence numeric(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
            status varchar(20) NOT NULL DEFAULT 'candidate'
                CHECK (status IN ('candidate','accepted','rejected','superseded','conflict')),
            observed_at timestamptz NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            created_by varchar(200) NOT NULL,
            CHECK (num_nonnulls(model_id, product_id) = 1),
            CHECK ((range_min IS NULL) = (range_max IS NULL)),
            CHECK (range_min IS NULL OR range_min <= range_max),
            CHECK (value_json IS NULL OR jsonb_typeof(value_json) = 'array')
        );
        CREATE UNIQUE INDEX uq_spec_observations_model_source
            ON spec_observations (source_document_id, definition_id, model_id)
            WHERE model_id IS NOT NULL;
        CREATE UNIQUE INDEX uq_spec_observations_product_source
            ON spec_observations (source_document_id, definition_id, product_id)
            WHERE product_id IS NOT NULL;
        CREATE INDEX idx_spec_observations_model_definition
            ON spec_observations (model_id, definition_id);
        CREATE INDEX idx_spec_observations_product_definition
            ON spec_observations (product_id, definition_id);

        CREATE TABLE canonical_spec_values (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            definition_id uuid NOT NULL REFERENCES spec_definitions(id) ON DELETE RESTRICT,
            selected_observation_id uuid NOT NULL UNIQUE
                REFERENCES spec_observations(id) ON DELETE RESTRICT,
            model_id uuid REFERENCES product_models(id) ON DELETE RESTRICT,
            product_id uuid REFERENCES products(id) ON DELETE RESTRICT,
            value_number numeric(24,8),
            range_min numeric(24,8),
            range_max numeric(24,8),
            value_boolean boolean,
            value_text text,
            option_id uuid REFERENCES spec_options(id) ON DELETE RESTRICT,
            value_json jsonb,
            revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
            verified_at timestamptz NOT NULL,
            updated_at timestamptz NOT NULL DEFAULT now(),
            updated_by varchar(200) NOT NULL,
            CHECK (num_nonnulls(model_id, product_id) = 1),
            CHECK ((range_min IS NULL) = (range_max IS NULL)),
            CHECK (range_min IS NULL OR range_min <= range_max),
            CHECK (value_json IS NULL OR jsonb_typeof(value_json) = 'array')
        );
        CREATE UNIQUE INDEX uq_canonical_spec_values_model
            ON canonical_spec_values (model_id, definition_id) WHERE model_id IS NOT NULL;
        CREATE UNIQUE INDEX uq_canonical_spec_values_product
            ON canonical_spec_values (product_id, definition_id) WHERE product_id IS NOT NULL;
        CREATE INDEX idx_canonical_spec_values_number_filter
            ON canonical_spec_values (definition_id, value_number) WHERE value_number IS NOT NULL;
        CREATE INDEX idx_canonical_spec_values_option_filter
            ON canonical_spec_values (definition_id, option_id) WHERE option_id IS NOT NULL;

        CREATE TABLE spec_audit_events (
            id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            actor varchar(200) NOT NULL,
            action varchar(100) NOT NULL,
            entity_type varchar(100) NOT NULL,
            entity_id varchar(255) NOT NULL,
            before jsonb,
            after jsonb,
            reason text NOT NULL CHECK (length(btrim(reason)) > 0),
            source_document_id uuid REFERENCES source_documents(id) ON DELETE RESTRICT,
            observation_id uuid REFERENCES spec_observations(id) ON DELETE RESTRICT,
            created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE INDEX idx_spec_audit_entity
            ON spec_audit_events (entity_type, entity_id, created_at DESC);

        CREATE TABLE spec_moderation_cases (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            case_type varchar(20) NOT NULL CHECK (case_type IN ('mapping','conflict','incomplete','stale')),
            status varchar(20) NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','assigned','resolved','dismissed')),
            entity_type varchar(100) NOT NULL,
            entity_id varchar(255) NOT NULL,
            definition_id uuid REFERENCES spec_definitions(id) ON DELETE RESTRICT,
            source_document_id uuid REFERENCES source_documents(id) ON DELETE RESTRICT,
            assignee varchar(200),
            due_at timestamptz,
            resolution text,
            created_at timestamptz NOT NULL DEFAULT now(),
            resolved_at timestamptz
        );
        CREATE INDEX idx_spec_moderation_open
            ON spec_moderation_cases (case_type, due_at) WHERE status IN ('open','assigned');

        CREATE TABLE spec_ingestion_runs (
            id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            task_id varchar(100) UNIQUE,
            source_adapter varchar(100) NOT NULL,
            status varchar(20) NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued','running','success','failed')),
            attempt integer NOT NULL DEFAULT 1 CHECK (attempt BETWEEN 1 AND 3),
            documents_count integer NOT NULL DEFAULT 0 CHECK (documents_count >= 0),
            observations_count integer NOT NULL DEFAULT 0 CHECK (observations_count >= 0),
            errors_count integer NOT NULL DEFAULT 0 CHECK (errors_count >= 0),
            error text,
            started_at timestamptz,
            finished_at timestamptz
        );

        CREATE TABLE model_mapping_reviews (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
            proposed_model_id uuid REFERENCES product_models(id) ON DELETE RESTRICT,
            current_model_id uuid REFERENCES product_models(id) ON DELETE RESTRICT,
            confidence numeric(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
            reason text NOT NULL CHECK (length(btrim(reason)) > 0),
            status varchar(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','accepted','rejected')),
            reviewer varchar(200),
            resolution_reason text,
            created_at timestamptz NOT NULL DEFAULT now(),
            reviewed_at timestamptz,
            CHECK (proposed_model_id IS NULL OR proposed_model_id <> current_model_id)
        );
        CREATE UNIQUE INDEX uq_model_mapping_review_pending_product
            ON model_mapping_reviews (product_id) WHERE status = 'pending';
        CREATE INDEX idx_model_mapping_reviews_queue
            ON model_mapping_reviews (status, created_at);

        CREATE TABLE comparison_pages (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            model_a_id uuid NOT NULL REFERENCES product_models(id) ON DELETE RESTRICT,
            model_b_id uuid NOT NULL REFERENCES product_models(id) ON DELETE RESTRICT,
            is_indexable boolean NOT NULL DEFAULT false,
            metadata_labels jsonb NOT NULL,
            updated_by varchar(200) NOT NULL,
            updated_at timestamptz NOT NULL DEFAULT now(),
            CHECK (model_a_id < model_b_id),
            UNIQUE (model_a_id, model_b_id),
            CONSTRAINT ck_comparison_pages_labels CHECK (
                jsonb_typeof(metadata_labels) = 'object'
                AND metadata_labels ?& ARRAY['az','ru']
            )
        );

        CREATE TABLE model_backfill_runs (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            status varchar(20) NOT NULL DEFAULT 'running'
                CHECK (status IN ('running','completed','failed')),
            batch_size integer NOT NULL CHECK (batch_size BETWEEN 1 AND 5000),
            batches_completed integer NOT NULL DEFAULT 0 CHECK (batches_completed >= 0),
            products_processed integer NOT NULL DEFAULT 0 CHECK (products_processed >= 0),
            last_product_id uuid,
            baseline jsonb NOT NULL,
            result jsonb,
            error text,
            started_at timestamptz NOT NULL DEFAULT now(),
            finished_at timestamptz
        );

        CREATE TABLE spec_readiness_queue (
            model_id uuid PRIMARY KEY REFERENCES product_models(id) ON DELETE CASCADE,
            requested_at timestamptz NOT NULL DEFAULT now(),
            attempts integer NOT NULL DEFAULT 0
        );
        """
    )

    op.execute(
        r"""
        CREATE OR REPLACE FUNCTION validate_typed_spec_row()
        RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE
            definition spec_definitions%ROWTYPE;
            target_category varchar(100);
            observation spec_observations%ROWTYPE;
            invalid_items integer;
        BEGIN
            SELECT * INTO STRICT definition FROM spec_definitions WHERE id = NEW.definition_id;

            IF NEW.model_id IS NOT NULL THEN
                SELECT category_id INTO STRICT target_category FROM product_models WHERE id = NEW.model_id;
                IF definition.scope = 'variant' THEN
                    RAISE EXCEPTION 'definition % only permits variant values', definition.key;
                END IF;
            ELSE
                SELECT pm.category_id INTO STRICT target_category
                FROM products p JOIN product_models pm ON pm.id = p.model_id
                WHERE p.id = NEW.product_id;
                IF definition.scope = 'model' THEN
                    RAISE EXCEPTION 'definition % only permits model values', definition.key;
                END IF;
            END IF;

            IF target_category <> definition.category_id THEN
                RAISE EXCEPTION 'definition category does not match target category';
            END IF;
            IF NEW.option_id IS NOT NULL AND NOT EXISTS (
                SELECT 1 FROM spec_options
                WHERE id = NEW.option_id AND definition_id = NEW.definition_id
            ) THEN
                RAISE EXCEPTION 'option does not belong to definition';
            END IF;

            IF definition.value_type = 'number' THEN
                IF NEW.value_number IS NULL OR num_nonnulls(NEW.range_min, NEW.range_max,
                    NEW.value_boolean, NEW.value_text, NEW.option_id, NEW.value_json) <> 0 THEN
                    RAISE EXCEPTION 'invalid number value branch';
                END IF;
            ELSIF definition.value_type = 'number_range' THEN
                IF NEW.range_min IS NULL OR NEW.range_max IS NULL OR NEW.range_min > NEW.range_max
                    OR num_nonnulls(NEW.value_number, NEW.value_boolean, NEW.value_text,
                        NEW.option_id, NEW.value_json) <> 0 THEN
                    RAISE EXCEPTION 'invalid number_range value branch';
                END IF;
            ELSIF definition.value_type = 'boolean' THEN
                IF NEW.value_boolean IS NULL OR num_nonnulls(NEW.value_number, NEW.range_min,
                    NEW.range_max, NEW.value_text, NEW.option_id, NEW.value_json) <> 0 THEN
                    RAISE EXCEPTION 'invalid boolean value branch';
                END IF;
            ELSIF definition.value_type = 'text' THEN
                IF NEW.value_text IS NULL OR num_nonnulls(NEW.value_number, NEW.range_min,
                    NEW.range_max, NEW.value_boolean, NEW.option_id, NEW.value_json) <> 0 THEN
                    RAISE EXCEPTION 'invalid text value branch';
                END IF;
            ELSIF definition.value_type = 'enum' THEN
                IF NEW.option_id IS NULL OR num_nonnulls(NEW.value_number, NEW.range_min,
                    NEW.range_max, NEW.value_boolean, NEW.value_text, NEW.value_json) <> 0 THEN
                    RAISE EXCEPTION 'invalid enum value branch';
                END IF;
            ELSIF definition.value_type IN ('number_list','option_set') THEN
                IF NEW.value_json IS NULL OR num_nonnulls(NEW.value_number, NEW.range_min,
                    NEW.range_max, NEW.value_boolean, NEW.value_text, NEW.option_id) <> 0 THEN
                    RAISE EXCEPTION 'invalid array value branch';
                END IF;
                IF definition.value_type = 'number_list' THEN
                    SELECT count(*) INTO invalid_items
                    FROM jsonb_array_elements(NEW.value_json) value
                    WHERE jsonb_typeof(value) <> 'number';
                ELSE
                    SELECT count(*) INTO invalid_items
                    FROM jsonb_array_elements(NEW.value_json) value
                    WHERE jsonb_typeof(value) <> 'string'
                       OR NOT EXISTS (
                           SELECT 1 FROM spec_options o
                           WHERE o.definition_id = NEW.definition_id
                             AND o.key = trim(both '"' from value::text)
                       );
                    IF (SELECT count(*) FROM jsonb_array_elements(NEW.value_json)) <>
                       (SELECT count(DISTINCT value) FROM jsonb_array_elements(NEW.value_json) value) THEN
                        invalid_items := invalid_items + 1;
                    END IF;
                END IF;
                IF invalid_items > 0 THEN
                    RAISE EXCEPTION 'array contains invalid or duplicate items';
                END IF;
            END IF;

            IF TG_TABLE_NAME = 'canonical_spec_values' THEN
                SELECT * INTO STRICT observation
                FROM spec_observations WHERE id = NEW.selected_observation_id;
                IF observation.definition_id <> NEW.definition_id
                   OR observation.model_id IS DISTINCT FROM NEW.model_id
                   OR observation.product_id IS DISTINCT FROM NEW.product_id THEN
                    RAISE EXCEPTION 'selected observation does not match canonical target';
                END IF;
            END IF;
            RETURN NEW;
        END;
        $$;

        CREATE CONSTRAINT TRIGGER trg_validate_spec_observation
        AFTER INSERT OR UPDATE ON spec_observations
        DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW EXECUTE FUNCTION validate_typed_spec_row();

        CREATE CONSTRAINT TRIGGER trg_validate_canonical_spec_value
        AFTER INSERT OR UPDATE ON canonical_spec_values
        DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW EXECUTE FUNCTION validate_typed_spec_row();

        CREATE OR REPLACE FUNCTION bump_canonical_revision()
        RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF TG_OP = 'UPDATE' THEN
                NEW.revision := OLD.revision + 1;
                NEW.updated_at := now();
            END IF;
            RETURN NEW;
        END;
        $$;
        CREATE TRIGGER trg_canonical_revision
        BEFORE UPDATE ON canonical_spec_values
        FOR EACH ROW EXECUTE FUNCTION bump_canonical_revision();

        CREATE OR REPLACE FUNCTION enqueue_model_readiness()
        RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE affected_model uuid;
        BEGIN
            affected_model := COALESCE(NEW.model_id, OLD.model_id);
            IF affected_model IS NULL THEN
                SELECT model_id INTO affected_model FROM products
                WHERE id = COALESCE(NEW.product_id, OLD.product_id);
            END IF;
            IF affected_model IS NOT NULL THEN
                UPDATE product_models
                SET spec_revision = spec_revision + 1, updated_at = now()
                WHERE id = affected_model;
                INSERT INTO spec_readiness_queue (model_id, requested_at, attempts)
                VALUES (affected_model, now(), 0)
                ON CONFLICT (model_id) DO UPDATE
                SET requested_at = EXCLUDED.requested_at, attempts = 0;
            END IF;
            RETURN COALESCE(NEW, OLD);
        END;
        $$;
        CREATE TRIGGER trg_canonical_enqueue_readiness
        AFTER INSERT OR UPDATE OR DELETE ON canonical_spec_values
        FOR EACH ROW EXECUTE FUNCTION enqueue_model_readiness();

        CREATE OR REPLACE FUNCTION bump_product_price_revision()
        RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF TG_OP IN ('UPDATE','DELETE') THEN
                UPDATE products SET price_revision = price_revision + 1 WHERE id = OLD.product_id;
            END IF;
            IF TG_OP IN ('INSERT','UPDATE') AND
               (TG_OP <> 'UPDATE' OR NEW.product_id IS DISTINCT FROM OLD.product_id) THEN
                UPDATE products SET price_revision = price_revision + 1 WHERE id = NEW.product_id;
            END IF;
            RETURN COALESCE(NEW, OLD);
        END;
        $$;
        CREATE TRIGGER trg_current_prices_revision
        AFTER INSERT OR UPDATE OR DELETE ON current_prices
        FOR EACH ROW EXECUTE FUNCTION bump_product_price_revision();

        CREATE OR REPLACE FUNCTION protect_product_model_slug()
        RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF NEW.slug IS DISTINCT FROM OLD.slug
               AND current_setting('app.allow_slug_rename', true) IS DISTINCT FROM 'on' THEN
                RAISE EXCEPTION 'product model slug is immutable outside the rename service';
            END IF;
            NEW.updated_at := now();
            RETURN NEW;
        END;
        $$;
        CREATE TRIGGER trg_product_model_slug_immutable
        BEFORE UPDATE ON product_models
        FOR EACH ROW EXECUTE FUNCTION protect_product_model_slug();

        CREATE OR REPLACE FUNCTION reject_audit_mutation()
        RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            RAISE EXCEPTION 'spec audit events are append-only';
        END;
        $$;
        CREATE TRIGGER trg_spec_audit_append_only
        BEFORE UPDATE OR DELETE ON spec_audit_events
        FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
        """
    )


def downgrade() -> None:
    op.execute(
        r"""
        DROP TRIGGER IF EXISTS trg_spec_audit_append_only ON spec_audit_events;
        DROP TRIGGER IF EXISTS trg_product_model_slug_immutable ON product_models;
        DROP TRIGGER IF EXISTS trg_current_prices_revision ON current_prices;
        DROP TRIGGER IF EXISTS trg_canonical_enqueue_readiness ON canonical_spec_values;
        DROP TRIGGER IF EXISTS trg_canonical_revision ON canonical_spec_values;
        DROP TRIGGER IF EXISTS trg_validate_canonical_spec_value ON canonical_spec_values;
        DROP TRIGGER IF EXISTS trg_validate_spec_observation ON spec_observations;
        DROP FUNCTION IF EXISTS reject_audit_mutation();
        DROP FUNCTION IF EXISTS protect_product_model_slug();
        DROP FUNCTION IF EXISTS bump_product_price_revision();
        DROP FUNCTION IF EXISTS enqueue_model_readiness();
        DROP FUNCTION IF EXISTS bump_canonical_revision();
        DROP FUNCTION IF EXISTS validate_typed_spec_row();

        DROP TABLE spec_readiness_queue;
        DROP TABLE model_backfill_runs;
        DROP TABLE comparison_pages;
        DROP TABLE model_mapping_reviews;
        DROP TABLE spec_ingestion_runs;
        DROP TABLE spec_moderation_cases;
        DROP TABLE spec_audit_events;
        DROP TABLE canonical_spec_values;
        DROP TABLE spec_observations;
        DROP TABLE source_documents;
        DROP TABLE spec_options;
        DROP TABLE spec_definitions;
        DROP TABLE spec_groups;
        DROP TABLE measurement_units;
        ALTER TABLE products DROP COLUMN price_revision;
        ALTER TABLE products DROP COLUMN is_default_variant;
        ALTER TABLE products DROP COLUMN model_id;
        DROP TABLE product_model_slug_aliases;
        DROP TABLE product_models;
        DROP TABLE categories;
        """
    )

import copy
import unittest

from shared.spec_taxonomy import (
    SMARTPHONE_CASE_FIXTURE_PATH,
    SMARTPHONE_FIXTURE_PATH,
    SMARTPHONE_TAXONOMY_PATH,
    SUPPORTED_VALUE_TYPES,
    TaxonomyValidationError,
    load_json,
    load_smartphone_cases,
    load_smartphone_contract,
    validate_comparison_cases,
    validate_fixture,
    validate_pilot_snapshot,
    validate_taxonomy,
)


def synthetic_pilot() -> dict:
    return {
        "contract_version": 1,
        "category_id": "smartphones",
        "limit": 50,
        "selection_rule": "synthetic public test ordering",
        "generated_at": "2026-01-01T00:00:00+00:00",
        "models": [
            {
                "rank": index,
                "pilot_key": f"fixture:synthetic phone {index}",
                "brand": "Fixture",
                "model_family": f"Synthetic Phone {index}",
                "representative_product_id": (f"00000000-0000-0000-0000-{index:012d}"),
                "variant_count": 1,
                "store_count": 0,
                "lowest_price_azn": None,
            }
            for index in range(1, 51)
        ],
    }


class SmartphoneTaxonomyTests(unittest.TestCase):
    def setUp(self) -> None:
        self.taxonomy = load_json(SMARTPHONE_TAXONOMY_PATH)
        self.fixture = load_json(SMARTPHONE_FIXTURE_PATH)
        self.cases = load_json(SMARTPHONE_CASE_FIXTURE_PATH)
        self.pilot = synthetic_pilot()

    def test_bundled_contract_is_valid_and_complete(self) -> None:
        taxonomy, fixture = load_smartphone_contract()

        self.assertEqual(taxonomy["category"]["id"], "smartphones")
        self.assertEqual(len(taxonomy["groups"]), 15)
        self.assertEqual(len(taxonomy["definitions"]), 66)
        self.assertEqual(len(fixture["models"]), 5)
        self.assertEqual(
            {item["value_type"] for item in taxonomy["definitions"]},
            SUPPORTED_VALUE_TYPES,
        )

    def test_synthetic_pilot_contract_is_valid_and_unique(self) -> None:
        validate_pilot_snapshot(self.taxonomy, self.pilot)
        self.assertEqual(len(self.pilot["models"]), 50)
        self.assertEqual(
            len({model["pilot_key"] for model in self.pilot["models"]}), 50
        )

    def test_pilot_rejects_duplicate_model(self) -> None:
        invalid = copy.deepcopy(self.pilot)
        invalid["models"][1]["pilot_key"] = invalid["models"][0]["pilot_key"]

        with self.assertRaisesRegex(TaxonomyValidationError, "duplicate pilot key"):
            validate_pilot_snapshot(self.taxonomy, invalid)

    def test_behavioral_cases_cover_phase_zero_edges(self) -> None:
        cases = load_smartphone_cases()

        self.assertEqual(
            {case["kind"] for case in cases["cases"]},
            {"tie", "missing", "variant_override", "source_conflict"},
        )

    def test_case_fixture_rejects_non_blocking_source_conflict(self) -> None:
        invalid = copy.deepcopy(self.cases)
        invalid["cases"][3]["expected"]["blocking_conflict"] = False

        with self.assertRaisesRegex(
            TaxonomyValidationError, "must expect a blocking conflict"
        ):
            validate_comparison_cases(self.taxonomy, invalid)

    def test_aggregate_product_score_key_is_rejected(self) -> None:
        invalid = copy.deepcopy(self.taxonomy)
        invalid["definitions"][0]["key"] = "overall_score"

        with self.assertRaisesRegex(
            TaxonomyValidationError, "aggregate product scoring is forbidden"
        ):
            validate_taxonomy(invalid)

    def test_non_numeric_definition_cannot_use_higher_better(self) -> None:
        invalid = copy.deepcopy(self.taxonomy)
        definition = next(
            item
            for item in invalid["definitions"]
            if item["key"] == "performance.chipset"
        )
        definition["comparison_rule"] = "higher_better"

        with self.assertRaisesRegex(
            TaxonomyValidationError, "numeric advantage requires number type"
        ):
            validate_taxonomy(invalid)

    def test_fixture_rejects_unknown_enum_option(self) -> None:
        invalid = copy.deepcopy(self.fixture)
        invalid["models"][0]["model_values"]["overview.os_family"] = "unknown"

        with self.assertRaisesRegex(TaxonomyValidationError, "unknown enum option"):
            validate_fixture(self.taxonomy, invalid)

    def test_fixture_requires_exactly_one_default_variant(self) -> None:
        invalid = copy.deepcopy(self.fixture)
        invalid["models"][0]["variants"][1]["is_default"] = True

        with self.assertRaisesRegex(
            TaxonomyValidationError, "exactly one default variant is required"
        ):
            validate_fixture(self.taxonomy, invalid)

    def test_fixture_rejects_model_value_at_variant_only_scope(self) -> None:
        invalid = copy.deepcopy(self.fixture)
        invalid["models"][0]["model_values"]["memory.storage_gb"] = 256

        with self.assertRaisesRegex(
            TaxonomyValidationError, "cannot be stored at model scope"
        ):
            validate_fixture(self.taxonomy, invalid)


if __name__ == "__main__":
    unittest.main()

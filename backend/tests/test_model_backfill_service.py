import uuid

from app.services.model_backfill_service import MappingCandidate, provisional_reason
from shared.model_identity import model_slug


def candidate(**overrides) -> MappingCandidate:
    values = {
        "product_id": uuid.UUID("00000000-0000-0000-0000-000000000001"),
        "category": "smartphones",
        "brand": "Apple",
        "model_family": "iPhone 17 Pro",
        "product_name": "Apple iPhone 17 Pro 256 GB",
    }
    values.update(overrides)
    return MappingCandidate(**values)


def test_model_slug_is_ascii_stable_and_only_needs_suffix_on_collision() -> None:
    assert model_slug("Əla Şirkət", "Özəl Çihaz") == "ela-sirket-ozel-cihaz"
    assert model_slug("Apple", "iPhone 17 Pro") == "apple-iphone-17-pro"


def test_exact_candidate_preserves_original_unicode_for_database_lowering() -> None:
    item = candidate(model_family="İntel Model")

    assert item.is_exact
    assert item.normalized_group == ("smartphones", "Apple", "İntel Model")


def test_missing_brand_is_quarantined_as_provisional() -> None:
    item = candidate(brand=None)

    assert not item.is_exact
    assert item.normalized_group is None
    assert provisional_reason(item) == "missing_brand"


def test_multiple_missing_identity_fields_are_reported() -> None:
    item = candidate(category=None, brand="", model_family=None)

    assert provisional_reason(item) == "missing_brand_and_model_family_and_category"

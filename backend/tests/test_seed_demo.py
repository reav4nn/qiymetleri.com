from scripts.seed_demo import DEMO_PRICES, DEMO_PRODUCTS, stable_uuid


def test_demo_catalogue_has_prices_for_every_product() -> None:
    product_ids = {product[0] for product in DEMO_PRODUCTS}

    assert product_ids == set(DEMO_PRICES)
    assert all(len(prices) >= 3 for prices in DEMO_PRICES.values())


def test_demo_identifiers_are_stable_and_unique() -> None:
    identifiers = [stable_uuid(product[0]) for product in DEMO_PRODUCTS]

    assert identifiers == [stable_uuid(product[0]) for product in DEMO_PRODUCTS]
    assert len(identifiers) == len(set(identifiers))

import {
  getRealCatalogueData,
  getRealHomeData,
  getRealProductPageData,
  realCatalogue,
} from "@/api/real-catalogue";

test("real snapshot contains a substantial image-backed catalogue", () => {
  expect(realCatalogue.products.length).toBeGreaterThan(400);
  expect(realCatalogue.products.every((product) => product.image_url.startsWith("https://"))).toBe(true);
  expect(new Set(realCatalogue.products.map((product) => product.category))).toEqual(new Set([
    "smartphones",
    "laptops",
    "televisions",
    "headphones",
    "tablets",
    "smartwatches",
  ]));
});

test("real home exposes image-backed products, categories and stores", () => {
  const home = getRealHomeData();

  expect(home.products).toHaveLength(8);
  expect(home.products.every((product) => Boolean(product.image_url))).toBe(true);
  expect(home.categories).toHaveLength(6);
  expect(home.stores.map((store) => store.id)).toEqual(expect.arrayContaining([
    "kontakt_home",
    "baku_electronics",
  ]));
});

test("real catalogue supports search, category filters and price sorting", () => {
  const catalogue = getRealCatalogueData({
    q: "iphone",
    category: "smartphones",
    sort_by: "price_asc",
    page: 1,
  });

  expect(catalogue.total).toBeGreaterThan(5);
  expect(catalogue.items.every((product) => product.name.toLowerCase().includes("iphone"))).toBe(true);
  expect(catalogue.items[0]?.lowest_price).toBeLessThanOrEqual(catalogue.items.at(-1)?.lowest_price ?? Infinity);
});

test("real product detail uses genuine store offers without fabricated history", () => {
  const source = realCatalogue.products.find((product) => product.offers.length > 1)!;
  const page = getRealProductPageData(source.id);

  expect(page?.product.image_url).toBe(source.image_url);
  expect(page?.product.current_prices.length).toBeGreaterThan(1);
  expect(page?.product.current_prices.every((offer) => offer.url?.startsWith("https://"))).toBe(true);
  expect(page?.history).toEqual([]);
});

import snapshotJson from "@/data/real-catalogue.json";
import type {
  CatalogueData,
  CatalogueQuery,
  CurrentPrice,
  FilterOption,
  FiltersResponse,
  HomeData,
  ProductDetail,
  ProductPageData,
  ProductSummary,
  ProductVariant,
} from "./api";

type RealProduct = {
  id: string;
  canonical_id: string;
  brand: string | null;
  category: string;
  model_family: string | null;
  name: string;
  image_url: string;
  attributes: Record<string, string | number>;
  offers: CurrentPrice[];
};

type RealCatalogueSnapshot = {
  generated_at: string;
  sources: { id: string; name: string }[];
  products: RealProduct[];
};

export const realCatalogue = snapshotJson as RealCatalogueSnapshot;

function variantFamilyKey(product: RealProduct): string | null {
  if (!product.model_family) return null;
  return `${product.brand ?? ""}\u0000${product.category}\u0000${product.model_family.toLocaleLowerCase("az")}`;
}

const variantCounts = new Map<string, number>();
for (const product of realCatalogue.products) {
  const key = variantFamilyKey(product);
  if (key) variantCounts.set(key, (variantCounts.get(key) ?? 0) + 1);
}

function optionCounts(
  values: string[],
  label: (value: string) => string = (value) => value,
): FilterOption[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts]
    .map(([id, count]) => ({ id, name: label(id), count }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function groupProducts(products: RealProduct[]): ProductSummary[] {
  const groups = new Map<string, RealProduct[]>();
  for (const product of products) {
    const key = variantFamilyKey(product) ?? product.id;
    const existing = groups.get(key);
    if (existing) {
      existing.push(product);
    } else {
      groups.set(key, [product]);
    }
  }

  const summaries: ProductSummary[] = [];

  for (const [key, items] of groups.entries()) {
    const allOffers = items.flatMap((p) => p.offers);
    const inStockOffers = allOffers.filter((o) => o.in_stock);
    const activeOffers = inStockOffers.length > 0 ? inStockOffers : allOffers;

    // Pick representative variant: lowest price, preferring in-stock
    let rep = items[0];
    let repLowestPrice: number | null = null;

    for (const item of items) {
      const itemInStock = item.offers.filter((o) => o.in_stock);
      const itemOffers = itemInStock.length > 0 ? itemInStock : item.offers;
      if (itemOffers.length > 0) {
        const itemMin = Math.min(...itemOffers.map((o) => o.price_azn));
        if (repLowestPrice === null || itemMin < repLowestPrice) {
          repLowestPrice = itemMin;
          rep = item;
        }
      }
    }

    const lowestPrice =
      activeOffers.length > 0
        ? Math.min(...activeOffers.map((o) => o.price_azn))
        : null;

    const storeCount = new Set(allOffers.map((o) => o.store_id)).size;
    const totalVariants = variantCounts.get(key) ?? items.length;

    // If multiple variants matched and model_family exists, collapse into model_family name
    const name =
      items.length > 1 && rep.model_family
        ? rep.model_family
        : rep.name;

    summaries.push({
      id: rep.id,
      canonical_id: rep.canonical_id,
      brand: rep.brand,
      category: rep.category,
      model_family: rep.model_family,
      name,
      image_url: rep.image_url,
      lowest_price: lowestPrice,
      store_count: storeCount,
      variant_count: totalVariants,
    });
  }

  return summaries;
}

function matchingProducts(query: CatalogueQuery): RealProduct[] {
  const search = query.q?.trim().toLocaleLowerCase("az") ?? "";
  return realCatalogue.products.filter((product) => {
    const searchable = `${product.name} ${product.brand ?? ""} ${product.model_family ?? ""}`
      .toLocaleLowerCase("az");
    return (
      (!search || searchable.includes(search)) &&
      (!query.category || product.category === query.category) &&
      (!query.brand || product.brand === query.brand) &&
      (!query.store_id || product.offers.some((offer) => offer.store_id === query.store_id))
    );
  });
}

function filtersFor(
  groupedItems: readonly ProductSummary[],
  rawProducts: readonly RealProduct[],
): FiltersResponse {
  const allOffers = rawProducts.flatMap((product) => product.offers);
  const prices = allOffers
    .filter((offer) => offer.in_stock)
    .map((offer) => offer.price_azn);

  return {
    categories: optionCounts(
      groupedItems.flatMap((p) => (p.category ? [p.category] : [])),
    ),
    brands: optionCounts(
      groupedItems.flatMap((p) => (p.brand ? [p.brand] : [])),
      (brand) => brand.charAt(0).toLocaleUpperCase("az") + brand.slice(1),
    ),
    stores: optionCounts(
      allOffers.map((offer) => offer.store_id),
      (storeId) =>
        realCatalogue.sources.find((store) => store.id === storeId)?.name ?? storeId,
    ),
    price_range: {
      min: prices.length ? Math.min(...prices) : null,
      max: prices.length ? Math.max(...prices) : null,
    },
  };
}

function interleaveCategories(products: ProductSummary[]): ProductSummary[] {
  const groups = new Map<string, ProductSummary[]>();
  for (const product of products) {
    const category = product.category ?? "other";
    const group = groups.get(category);
    if (group) group.push(product);
    else groups.set(category, [product]);
  }
  const result: ProductSummary[] = [];
  const queues = [...groups.values()];
  while (queues.some((queue) => queue.length)) {
    for (const queue of queues) {
      const product = queue.shift();
      if (product) result.push(product);
    }
  }
  return result;
}

function variantsFor(product: RealProduct): RealProduct[] {
  const familyKey = variantFamilyKey(product);
  if (!familyKey) return [product];
  return realCatalogue.products.filter((candidate) => variantFamilyKey(candidate) === familyKey);
}

function productVariant(product: RealProduct): ProductVariant {
  return {
    id: product.id,
    name: product.name,
    storage_gb:
      typeof product.attributes.storage_gb === "number"
        ? product.attributes.storage_gb
        : null,
    color:
      typeof product.attributes.color === "string" ? product.attributes.color : null,
    current_prices: product.offers,
  };
}

export function getRealHomeData(): HomeData {
  const allGrouped = groupProducts(realCatalogue.products);
  const products = interleaveCategories(
    allGrouped.sort(
      (left, right) =>
        right.store_count - left.store_count ||
        right.variant_count - left.variant_count ||
        (left.lowest_price ?? Infinity) - (right.lowest_price ?? Infinity),
    ),
  ).slice(0, 8);
  const filters = filtersFor(allGrouped, realCatalogue.products);
  return {
    products,
    categories: filters.categories,
    stores: filters.stores,
    available: true,
  };
}

export function getRealCatalogueData(query: CatalogueQuery): CatalogueData {
  const page = Math.max(1, Number(query.page) || 1);
  const perPage = 20;
  const matching = matchingProducts(query);
  const grouped = groupProducts(matching);

  const items = grouped.sort((left, right) => {
    if (query.sort_by === "price_asc") {
      return (left.lowest_price ?? Infinity) - (right.lowest_price ?? Infinity);
    }
    if (query.sort_by === "price_desc") {
      return (right.lowest_price ?? -Infinity) - (left.lowest_price ?? -Infinity);
    }
    if (query.sort_by === "popular") {
      return right.store_count - left.store_count || right.variant_count - left.variant_count;
    }
    return left.name.localeCompare(right.name);
  });

  const start = (page - 1) * perPage;
  return {
    items: items.slice(start, start + perPage),
    total: items.length,
    page,
    per_page: perPage,
    pages: Math.max(1, Math.ceil(items.length / perPage)),
    filters: filtersFor(grouped, matching),
    available: true,
  };
}

export function getRealProductPageData(productId: string): ProductPageData {
  const source = realCatalogue.products.find(
    (product) => product.id === productId || product.canonical_id === productId,
  );
  if (!source) return { status: "not-found" };
  const allGrouped = groupProducts(realCatalogue.products);
  const product: ProductDetail = {
    id: source.id,
    canonical_id: source.canonical_id,
    brand: source.brand,
    category: source.category,
    model_family: source.model_family,
    name: source.name,
    image_url: source.image_url,
    attributes: source.attributes,
    current_prices: source.offers,
    variants: variantsFor(source).map(productVariant),
    created_at: realCatalogue.generated_at,
    updated_at: realCatalogue.generated_at,
  };
  return {
    status: "ready",
    product,
    history: [],
    stores: filtersFor(allGrouped, realCatalogue.products).stores,
  };
}

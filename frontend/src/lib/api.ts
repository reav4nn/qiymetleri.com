export type FilterOption = { id: string; name: string; count: number };

export type ProductSummary = {
  id: string;
  canonical_id: string;
  brand: string | null;
  category: string | null;
  model_family: string | null;
  name: string;
  image_url: string | null;
  lowest_price: number | null;
  store_count: number;
  variant_count: number;
};

export type CurrentPrice = {
  id: string;
  store_id: string;
  price_azn: number;
  original_title: string | null;
  url: string | null;
  in_stock: boolean;
  last_checked_at: string;
};

export type ProductVariant = {
  id: string;
  name: string;
  storage_gb: number | null;
  color: string | null;
  current_prices: CurrentPrice[];
};

export type ProductDetail = {
  id: string;
  canonical_id: string;
  brand: string | null;
  category: string | null;
  model_family: string | null;
  name: string;
  image_url: string | null;
  attributes: Record<string, unknown> | null;
  current_prices: CurrentPrice[];
  variants: ProductVariant[];
  created_at: string;
  updated_at: string;
};

export type PriceHistoryPoint = {
  time: string;
  product_id: string;
  store_id: string;
  price_azn: number;
  in_stock: boolean | null;
};

export type ProductsResponse = {
  items: ProductSummary[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
};

export type FiltersResponse = {
  categories: FilterOption[];
  brands: FilterOption[];
  stores: FilterOption[];
  price_range?: { min: number | null; max: number | null };
};

export type HomeData = {
  products: ProductSummary[];
  categories: FilterOption[];
  stores: FilterOption[];
  available: boolean;
};

const API_BASE_URL =
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

type CatalogueQuery = {
  q?: string;
  category?: string;
  brand?: string;
  store_id?: string;
  sort_by?: string;
  page?: string;
};

function queryString(query: CatalogueQuery, includePaging = true): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value && (includePaging || (key !== "page" && key !== "sort_by"))) {
      params.set(key, value);
    }
  }
  if (includePaging) {
    params.set("per_page", "20");
  }
  return params.toString();
}

export async function getHomeData(): Promise<HomeData> {
  try {
    const [productsResponse, filtersResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/api/v1/products?per_page=8&sort_by=price_asc`, {
        next: { revalidate: 300 },
      }),
      fetch(`${API_BASE_URL}/api/v1/filters`, { next: { revalidate: 600 } }),
    ]);

    if (!productsResponse.ok || !filtersResponse.ok) {
      throw new Error("API request failed");
    }

    const products = (await productsResponse.json()) as ProductsResponse;
    const filters = (await filtersResponse.json()) as FiltersResponse;
    return {
      products: products.items,
      categories: filters.categories,
      stores: filters.stores,
      available: true,
    };
  } catch {
    return { products: [], categories: [], stores: [], available: false };
  }
}

export type CatalogueData = ProductsResponse & {
  filters: FiltersResponse;
  available: boolean;
};

export async function getCatalogueData(
  query: CatalogueQuery,
): Promise<CatalogueData> {
  try {
    const [productsResponse, filtersResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/api/v1/products?${queryString(query)}`, {
        next: { revalidate: 120 },
      }),
      fetch(
        `${API_BASE_URL}/api/v1/filters?${queryString(query, false)}`,
        { next: { revalidate: 300 } },
      ),
    ]);

    if (!productsResponse.ok || !filtersResponse.ok) {
      throw new Error("API request failed");
    }

    const products = (await productsResponse.json()) as ProductsResponse;
    const filters = (await filtersResponse.json()) as FiltersResponse;
    return { ...products, filters, available: true };
  } catch {
    return {
      items: [],
      total: 0,
      page: 1,
      per_page: 20,
      pages: 0,
      filters: { categories: [], brands: [], stores: [] },
      available: false,
    };
  }
}

export type ProductPageData =
  | {
      status: "ready";
      product: ProductDetail;
      history: PriceHistoryPoint[];
      stores: FilterOption[];
    }
  | { status: "not-found" }
  | { status: "unavailable" };

export async function getProductPageData(
  productId: string,
): Promise<ProductPageData> {
  try {
    const productResponse = await fetch(
      `${API_BASE_URL}/api/v1/products/${encodeURIComponent(productId)}`,
      { next: { revalidate: 120 } },
    );

    if (productResponse.status === 404 || productResponse.status === 422) {
      return { status: "not-found" };
    }
    if (!productResponse.ok) {
      throw new Error("Product API request failed");
    }

    const product = (await productResponse.json()) as ProductDetail;
    const [historyResult, filtersResult] = await Promise.allSettled([
      fetch(
        `${API_BASE_URL}/api/v1/products/${encodeURIComponent(productId)}/history?days=30`,
        { next: { revalidate: 300 } },
      ).then(async (response) =>
        response.ok ? ((await response.json()) as PriceHistoryPoint[]) : [],
      ),
      fetch(`${API_BASE_URL}/api/v1/filters`, {
        next: { revalidate: 600 },
      }).then(async (response) =>
        response.ok ? ((await response.json()) as FiltersResponse) : null,
      ),
    ]);

    return {
      status: "ready",
      product,
      history: historyResult.status === "fulfilled" ? historyResult.value : [],
      stores:
        filtersResult.status === "fulfilled" && filtersResult.value
          ? filtersResult.value.stores
          : [],
    };
  } catch {
    return { status: "unavailable" };
  }
}

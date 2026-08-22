import { ApiError, apiGet, buildQuery } from "@/api/client";
import {
  realCatalogue,
  getRealCatalogueData,
  getRealHomeData,
  getRealProductPageData,
} from "@/api/real-catalogue";
import type {
  CatalogueData,
  CatalogueQuery,
  FiltersResponse,
  HomeData,
  PriceHistoryPoint,
  ProductDetail,
  ProductPageData,
  ProductsResponse,
} from "@/api/types";

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return;
  const error = signal.reason instanceof Error ? signal.reason : new Error("Request aborted");
  error.name = "AbortError";
  throw error;
}

function rankPopular(products: ProductsResponse): ProductsResponse {
  return {
    ...products,
    items: [...products.items]
      .sort((left, right) =>
        right.store_count - left.store_count
          || right.variant_count - left.variant_count
          || (left.lowest_price ?? Infinity) - (right.lowest_price ?? Infinity),
      )
      .slice(0, 8),
  };
}

async function getLiveHomeProducts(signal?: AbortSignal): Promise<ProductsResponse> {
  try {
    return await apiGet<ProductsResponse>(
      "/api/v1/products?per_page=8&sort_by=popular",
      signal,
    );
  } catch (error) {
    // Older deployments did not accept the `popular` sort mode. Preserve the
    // same ranking locally instead of discarding an otherwise healthy API.
    if (!(error instanceof ApiError) || error.status !== 422) throw error;
    const products = await apiGet<ProductsResponse>(
      "/api/v1/products?per_page=100&sort_by=name",
      signal,
    );
    return rankPopular(products);
  }
}

export async function getHomeData(signal?: AbortSignal): Promise<HomeData> {
  const fallback = getRealHomeData();
  const [productsResult, filtersResult] = await Promise.allSettled([
    getLiveHomeProducts(signal),
    apiGet<FiltersResponse>("/api/v1/filters", signal),
  ]);
  throwIfAborted(signal);

  if (productsResult.status === "rejected" && filtersResult.status === "rejected") {
    return fallback;
  }

  return {
    dataSource: productsResult.status === "fulfilled" && filtersResult.status === "fulfilled"
      ? "live"
      : "mixed",
    ...(productsResult.status === "rejected" || filtersResult.status === "rejected"
      ? { snapshotGeneratedAt: realCatalogue.generated_at }
      : {}),
    products: productsResult.status === "fulfilled"
      ? productsResult.value.items
      : fallback.products,
    categories: filtersResult.status === "fulfilled"
      ? filtersResult.value.categories
      : fallback.categories,
    stores: filtersResult.status === "fulfilled"
      ? filtersResult.value.stores
      : fallback.stores,
  };
}

export async function getCatalogueData(
  query: CatalogueQuery,
  signal?: AbortSignal,
): Promise<CatalogueData> {
  const productsQuery = buildQuery({ ...query, per_page: 20 });
  const filtersQuery = buildQuery({
    q: query.q,
    category: query.category,
    brand: query.brand,
    store_id: query.store_id,
  });
  const fallback = getRealCatalogueData(query);
  const [productsResult, filtersResult] = await Promise.allSettled([
    apiGet<ProductsResponse>(`/api/v1/products?${productsQuery}`, signal),
    apiGet<FiltersResponse>(`/api/v1/filters?${filtersQuery}`, signal),
  ]);
  throwIfAborted(signal);

  if (productsResult.status === "rejected" && filtersResult.status === "rejected") {
    return fallback;
  }

  const products = productsResult.status === "fulfilled" ? productsResult.value : fallback;
  return {
    ...products,
    dataSource: productsResult.status === "fulfilled" && filtersResult.status === "fulfilled"
      ? "live"
      : "mixed",
    ...(productsResult.status === "rejected" || filtersResult.status === "rejected"
      ? { snapshotGeneratedAt: realCatalogue.generated_at }
      : {}),
    filters: filtersResult.status === "fulfilled" ? filtersResult.value : fallback.filters,
  };
}

export async function getProductPageData(
  productId: string,
  signal?: AbortSignal,
): Promise<ProductPageData> {
  const encodedId = encodeURIComponent(productId);
  try {
    const product = await apiGet<ProductDetail>(`/api/v1/products/${encodedId}`, signal);
    const [historyResult, filtersResult] = await Promise.allSettled([
      apiGet<PriceHistoryPoint[]>(`/api/v1/products/${encodedId}/history?days=30`, signal),
      apiGet<FiltersResponse>("/api/v1/filters", signal),
    ]);
    throwIfAborted(signal);

    const usesFallback = historyResult.status === "rejected" || filtersResult.status === "rejected";

    return {
      dataSource: usesFallback ? "mixed" : "live",
      ...(usesFallback ? { snapshotGeneratedAt: realCatalogue.generated_at } : {}),
      product,
      history: historyResult.status === "fulfilled" ? historyResult.value : [],
      stores: filtersResult.status === "fulfilled"
        ? filtersResult.value.stores
        : getRealHomeData().stores,
    };
  } catch (error) {
    throwIfAborted(signal);
    const realProduct = getRealProductPageData(productId);
    if (realProduct) return realProduct;
    throw error;
  }
}

import * as client from "@/api/client";
import { ApiError } from "@/api/client";
import { getCatalogueData, getHomeData } from "@/api/catalogue";
import type { FiltersResponse, ProductSummary, ProductsResponse } from "@/api/types";

const product: ProductSummary = {
  id: "live-product",
  canonical_id: "live-product",
  brand: "Test",
  category: "smartphones",
  model_family: "Test Phone",
  name: "Live product",
  image_url: "https://example.com/product.png",
  lowest_price: 100,
  store_count: 3,
  variant_count: 2,
};

const products: ProductsResponse = {
  items: [product],
  total: 1,
  page: 1,
  per_page: 20,
  pages: 1,
};

const filters: FiltersResponse = {
  categories: [{ id: "smartphones", name: "smartphones", count: 1 }],
  brands: [{ id: "Test", name: "Test", count: 1 }],
  stores: [{ id: "test-store", name: "Test store", count: 1 }],
};

const apiGet = jest.spyOn(client, "apiGet");

beforeEach(() => apiGet.mockReset());

test("keeps live catalogue products when only filters fail", async () => {
  apiGet.mockImplementation(async (path) => {
    if (path.startsWith("/api/v1/products?")) return products;
    throw new ApiError("filters unavailable", 500, "HTTP_ERROR");
  });

  const result = await getCatalogueData({ sort_by: "name", page: 1 });

  expect(result.dataSource).toBe("mixed");
  expect(result.items).toEqual([product]);
  expect(result.filters.categories.length).toBeGreaterThan(0);
  expect(result.snapshotGeneratedAt).toBeTruthy();
});

test("uses the complete saved catalogue only when both live requests fail", async () => {
  apiGet.mockRejectedValue(new ApiError("service unavailable", 500, "HTTP_ERROR"));

  const result = await getCatalogueData({ q: "iphone", sort_by: "name", page: 1 });

  expect(result.dataSource).toBe("snapshot");
  expect(result.total).toBeGreaterThan(0);
  expect(result.items.every((item) => item.name.toLocaleLowerCase("az").includes("iphone"))).toBe(true);
});

test("falls back to compatible live sorting when the deployment rejects popular", async () => {
  apiGet.mockImplementation(async (path) => {
    if (path.includes("sort_by=popular")) {
      throw new ApiError("unsupported sort", 422, "HTTP_ERROR");
    }
    if (path.includes("sort_by=name")) return products;
    return filters;
  });

  const result = await getHomeData();

  expect(result.dataSource).toBe("live");
  expect(result.products).toEqual([product]);
  expect(apiGet).toHaveBeenCalledWith(
    "/api/v1/products?per_page=100&sort_by=name",
    undefined,
  );
});

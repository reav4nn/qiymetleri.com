export type FilterOption = { id: string; name: string; count: number };

export type ProductSummary = {
  id: string;
  name: string;
  image_url: string | null;
  lowest_price: number | null;
  store_count: number;
  variant_count: number;
};

type ProductsResponse = { items: ProductSummary[] };
type FiltersResponse = { categories: FilterOption[]; stores: FilterOption[] };

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

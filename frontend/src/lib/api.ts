const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Product {
  id: string;
  canonical_id: string;
  brand: string | null;
  category: string | null;
  model_family: string | null;
  name: string;
  lowest_price: number | null;
  store_count: number;
}

export interface ProductDetail {
  id: string;
  canonical_id: string;
  brand: string | null;
  category: string | null;
  model_family: string | null;
  name: string;
  attributes: Record<string, unknown> | null;
  current_prices: CurrentPrice[];
  created_at: string;
  updated_at: string;
}

export interface CurrentPrice {
  id: string;
  store_id: string;
  price_azn: number;
  original_title: string | null;
  url: string | null;
  in_stock: boolean;
  last_checked_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface PriceHistory {
  time: string;
  product_id: string;
  store_id: string;
  price_azn: number;
  in_stock: boolean | null;
}

export async function fetchProducts(params: {
  page?: number;
  per_page?: number;
  category?: string;
  brand?: string;
  q?: string;
  sort_by?: string;
}): Promise<PaginatedResponse<Product>> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.set(key, String(value));
    }
  });

  const res = await fetch(
    `${API_BASE_URL}/api/v1/products?${searchParams.toString()}`,
    { next: { revalidate: 300 } }
  );
  if (!res.ok) throw new Error("Failed to fetch products");
  return res.json();
}

export async function fetchProduct(id: string): Promise<ProductDetail> {
  const res = await fetch(`${API_BASE_URL}/api/v1/products/${id}`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error("Failed to fetch product");
  return res.json();
}

export async function searchProducts(
  q: string,
  page: number = 1
): Promise<PaginatedResponse<Product>> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/search?q=${encodeURIComponent(q)}&page=${page}`,
    { next: { revalidate: 180 } }
  );
  if (!res.ok) throw new Error("Failed to search products");
  return res.json();
}

export async function fetchPriceHistory(
  productId: string,
  days: number = 30
): Promise<PriceHistory[]> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/products/${productId}/history?days=${days}`,
    { next: { revalidate: 300 } }
  );
  if (!res.ok) throw new Error("Failed to fetch price history");
  return res.json();
}

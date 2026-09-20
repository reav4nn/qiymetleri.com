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

export type DataSource = "live" | "mixed" | "snapshot";

export type DataFreshness = {
  dataSource: DataSource;
  snapshotGeneratedAt?: string;
};

export type HomeData = DataFreshness & {
  products: ProductSummary[];
  categories: FilterOption[];
  stores: FilterOption[];
};

export type CatalogueQuery = {
  q?: string;
  category?: string;
  brand?: string;
  store_id?: string;
  sort_by?: "name" | "price_asc" | "price_desc" | "popular";
  page?: number;
};

export type CatalogueData = ProductsResponse & DataFreshness & { filters: FiltersResponse };

export type ProductPageData = DataFreshness & {
  product: ProductDetail;
  history: PriceHistoryPoint[];
  stores: FilterOption[];
};

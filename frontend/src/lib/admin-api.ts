// Use relative URL so client-side fetches go through nginx proxy
const API_BASE_URL = "";

export interface DashboardStats {
  total_products: number;
  total_variants: number;
  total_stores: number;
  active_stores: number;
  total_prices: number;
  price_range_min: number | null;
  price_range_max: number | null;
  products_with_images: number;
  last_price_update: string | null;
  categories: { name: string; count: number }[];
}

export interface SpiderStatus {
  name: string;
  display_name: string;
  last_run: string | null;
  last_status: string | null;
  last_item_count: number | null;
  last_duration: number | null;
  schedule: string;
  is_running: boolean;
}

export interface ScraperOverview {
  spiders: SpiderStatus[];
  worker_online: boolean;
  active_tasks: number;
  scheduled_tasks: number;
}

export interface TaskResult {
  task_id: string;
  spider: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  item_count: number | null;
  duration: number | null;
  error: string | null;
}

export interface StoreHealth {
  id: string;
  name: string;
  base_url: string;
  is_active: boolean;
  product_count: number;
  in_stock_count: number;
  avg_price: number | null;
  min_price: number | null;
  max_price: number | null;
  last_crawl: string | null;
  last_price_update: string | null;
}

export interface PriceAnomaly {
  product_id: string;
  product_name: string;
  store_id: string;
  old_price: number;
  new_price: number;
  change_pct: number;
  detected_at: string;
}

export interface TriggerResponse {
  task_id: string;
  spider: string;
  status: string;
  message: string;
}

export interface RecentProduct {
  product_id: string;
  name: string;
  brand: string | null;
  category: string | null;
  image_url: string | null;
  created_at: string | null;
  price: number | null;
  url: string | null;
  in_stock: boolean | null;
  store_name: string;
  store_id: string;
}

async function adminFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/api/v1/admin${path}`, {
    cache: "no-store",
    credentials: "include",
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`Admin API error ${res.status}: ${text}`);
  }
  return res.json();
}

export function fetchDashboard(): Promise<DashboardStats> {
  return adminFetch("/dashboard");
}

export function fetchScraperStatus(): Promise<ScraperOverview> {
  return adminFetch("/scraper/status");
}

export function triggerSpider(name: string): Promise<TriggerResponse> {
  return adminFetch(`/scraper/trigger/${name}`, { method: "POST" });
}

export function fetchScraperHistory(limit = 20): Promise<TaskResult[]> {
  return adminFetch(`/scraper/history?limit=${limit}`);
}

export function fetchStoreHealth(): Promise<StoreHealth[]> {
  return adminFetch("/stores");
}

export function fetchAnomalies(threshold = 30, hours = 24): Promise<PriceAnomaly[]> {
  return adminFetch(`/anomalies?threshold=${threshold}&hours=${hours}`);
}

export function fetchRecentProducts(minutes = 60, storeId?: number): Promise<RecentProduct[]> {
  const params = new URLSearchParams({ minutes: String(minutes) });
  if (storeId !== undefined) params.set("store_id", String(storeId));
  return adminFetch(`/products/recent?${params}`);
}

export interface MatchStats {
  pending: number;
  accepted: number;
  rejected: number;
  total: number;
}

export interface MatchProduct {
  name: string;
  store_id: string;
  url: string | null;
  price: number;
}

export interface ProductMatch {
  id: number;
  family_a: string;
  family_b: string;
  brand: string;
  similarity: number;
  status: string;
  created_at: string;
  stores_a: string | null;
  stores_b: string | null;
  count_a: number;
  count_b: number;
  products_a: MatchProduct[];
  products_b: MatchProduct[];
}

export function fetchMatchStats(): Promise<MatchStats> {
  return adminFetch("/matches/stats");
}

export function fetchPendingMatches(limit = 50): Promise<ProductMatch[]> {
  return adminFetch(`/matches/pending?limit=${limit}`);
}

export function reviewMatch(id: number, action: "accept" | "reject"): Promise<{ id: number; status: string }> {
  return adminFetch(`/matches/${id}/${action}`, { method: "POST" });
}

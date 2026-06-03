// Server components need full URL; client components use relative URL via nginx/rewrite
const API_BASE_URL =
  typeof window === "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000")
    : "";

function getAuthHeader(): string | null {
  if (typeof window === "undefined") {
    // Server-side: use env vars (not NEXT_PUBLIC — stays on server)
    const user = process.env.ADMIN_USER;
    const pass = process.env.ADMIN_PASSWORD;
    if (user && pass) return `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
    return null;
  }
  const token = sessionStorage.getItem("admin_auth");
  return token ? `Basic ${token}` : null;
}

function promptAndStoreCredentials(): string | null {
  if (typeof window === "undefined") return null;
  const user = window.prompt("Admin username:");
  if (!user) return null;
  const pass = window.prompt("Admin password:");
  if (!pass) return null;
  const token = btoa(`${user}:${pass}`);
  sessionStorage.setItem("admin_auth", token);
  return `Basic ${token}`;
}

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
  const headers: Record<string, string> = {
    ...Object.fromEntries(
      Object.entries(options?.headers || {})
    ),
  };
  const auth = getAuthHeader();
  if (auth) headers["Authorization"] = auth;

  const url = `${API_BASE_URL}/api/v1/admin${path}`;
  let res = await fetch(url, { cache: "no-store", ...options, headers });

  // On 401, prompt for credentials and retry once
  if (res.status === 401 && typeof window !== "undefined") {
    const newAuth = promptAndStoreCredentials();
    if (newAuth) {
      headers["Authorization"] = newAuth;
      res = await fetch(url, { cache: "no-store", ...options, headers });
    }
    if (res.status === 401) {
      sessionStorage.removeItem("admin_auth");
      throw new Error("Authentication failed — invalid credentials");
    }
  }

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

// ── Product Management ──

export interface AdminProduct {
  id: string;
  canonical_id: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  model_family: string | null;
  image_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  prices: {
    store_id: string;
    price_azn: number;
    in_stock: boolean;
    url: string | null;
  }[];
}

export interface AdminProductList {
  items: AdminProduct[];
  total: number;
  page: number;
  per_page: number;
}

export interface ProductUpdatePayload {
  name?: string;
  brand?: string;
  category?: string;
  model_family?: string;
  image_url?: string;
}

export function fetchAdminProducts(params: {
  page?: number;
  per_page?: number;
  category?: string;
  brand?: string;
  store_id?: string;
  q?: string;
}): Promise<AdminProductList> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.per_page) qs.set("per_page", String(params.per_page));
  if (params.category) qs.set("category", params.category);
  if (params.brand) qs.set("brand", params.brand);
  if (params.store_id) qs.set("store_id", params.store_id);
  if (params.q) qs.set("q", params.q);
  return adminFetch(`/products?${qs}`);
}

export function updateProduct(id: string, data: ProductUpdatePayload): Promise<{ id: string; updated: boolean }> {
  return adminFetch(`/products/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function deleteProduct(id: string): Promise<{ id: string; deleted: boolean }> {
  return adminFetch(`/products/${id}`, { method: "DELETE" });
}

export function batchDeleteProducts(ids: string[]): Promise<{ deleted: number }> {
  return adminFetch("/products/batch/delete", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ids),
  });
}

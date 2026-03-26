"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { FilterOptions } from "@/lib/api";

const CATEGORY_ICONS: Record<string, string> = {
  smartphones: "📱",
  laptops: "💻",
  headphones: "🎧",
  smartwatches: "⌚",
};

interface FilterPanelProps {
  filters: FilterOptions;
}

export function FilterPanel({ filters }: FilterPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("filter");
  const tc = useTranslations("categories");

  const locale = pathname.split("/")[1] || "az";

  const currentCategory = searchParams.get("category") || "";
  const currentBrand = searchParams.get("brand") || "";
  const currentStore = searchParams.get("store_id") || "";
  const currentSort = searchParams.get("sort_by") || "name";
  const currentMinPrice = searchParams.get("min_price") || "";
  const currentMaxPrice = searchParams.get("max_price") || "";
  const currentQuery = searchParams.get("q") || "";

  const [minPrice, setMinPrice] = useState(currentMinPrice);
  const [maxPrice, setMaxPrice] = useState(currentMaxPrice);
  const [mobileOpen, setMobileOpen] = useState(false);

  const applyFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page");

      startTransition(() => {
        router.push(`/${locale}/search?${params.toString()}`);
      });
    },
    [router, searchParams, startTransition, locale]
  );

  const applyPriceRange = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (minPrice) params.set("min_price", minPrice);
    else params.delete("min_price");
    if (maxPrice) params.set("max_price", maxPrice);
    else params.delete("max_price");
    params.delete("page");

    startTransition(() => {
      router.push(`/${locale}/search?${params.toString()}`);
    });
  }, [router, searchParams, minPrice, maxPrice, startTransition, locale]);

  const clearAllFilters = useCallback(() => {
    const params = new URLSearchParams();
    if (currentQuery) params.set("q", currentQuery);
    startTransition(() => {
      router.push(`/${locale}/search?${params.toString()}`);
    });
    setMinPrice("");
    setMaxPrice("");
  }, [router, currentQuery, startTransition, locale]);

  const hasActiveFilters =
    currentCategory ||
    currentBrand ||
    currentStore ||
    currentMinPrice ||
    currentMaxPrice ||
    currentSort !== "name";

  const SORT_OPTIONS = [
    { value: "name", label: t("sortNameAZ") },
    { value: "price_asc", label: t("sortPriceAsc") },
    { value: "price_desc", label: t("sortPriceDesc") },
  ];

  const filterContent = (
    <div className="space-y-6">
      {/* Active filters indicator */}
      {hasActiveFilters && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-blue-600">
            {t("filtersActive")}
          </span>
          <button
            onClick={clearAllFilters}
            className="text-xs text-red-500 hover:text-red-700 underline"
          >
            {t("clearAll")}
          </button>
        </div>
      )}

      {/* Sort */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-700">{t("sort")}</h3>
        <select
          value={currentSort}
          onChange={(e) => applyFilter("sort_by", e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Categories */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-700">
          {t("category")}
        </h3>
        <div className="space-y-1">
          <button
            onClick={() => applyFilter("category", "")}
            className={`block w-full rounded-md px-3 py-1.5 text-left text-sm transition ${
              !currentCategory
                ? "bg-blue-50 font-medium text-blue-700"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {t("all")}
          </button>
          {filters.categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() =>
                applyFilter("category", currentCategory === cat.id ? "" : cat.id)
              }
              className={`flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-sm transition ${
                currentCategory === cat.id
                  ? "bg-blue-50 font-medium text-blue-700"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span>
                {CATEGORY_ICONS[cat.id] ? `${CATEGORY_ICONS[cat.id]} ` : ""}
                {tc.has(cat.id) ? tc(cat.id) : cat.name}
              </span>
              <span className="text-xs text-gray-400">{cat.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Stores */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-700">{t("store")}</h3>
        <div className="space-y-1">
          <button
            onClick={() => applyFilter("store_id", "")}
            className={`block w-full rounded-md px-3 py-1.5 text-left text-sm transition ${
              !currentStore
                ? "bg-blue-50 font-medium text-blue-700"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {t("all")}
          </button>
          {filters.stores.map((store) => (
            <button
              key={store.id}
              onClick={() =>
                applyFilter(
                  "store_id",
                  currentStore === store.id ? "" : store.id
                )
              }
              className={`flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-sm transition ${
                currentStore === store.id
                  ? "bg-blue-50 font-medium text-blue-700"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span>{store.name}</span>
              <span className="text-xs text-gray-400">{store.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Brands */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-700">{t("brand")}</h3>
        <div className="max-h-56 space-y-1 overflow-y-auto">
          <button
            onClick={() => applyFilter("brand", "")}
            className={`block w-full rounded-md px-3 py-1.5 text-left text-sm transition ${
              !currentBrand
                ? "bg-blue-50 font-medium text-blue-700"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {t("all")}
          </button>
          {filters.brands.map((brand) => (
            <button
              key={brand.id}
              onClick={() =>
                applyFilter("brand", currentBrand === brand.id ? "" : brand.id)
              }
              className={`flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-sm transition ${
                currentBrand === brand.id
                  ? "bg-blue-50 font-medium text-blue-700"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span className="capitalize">{brand.name}</span>
              <span className="text-xs text-gray-400">{brand.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-700">
          {t("priceRange")}
        </h3>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder={String(Math.floor(filters.price_range.min))}
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyPriceRange()}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            min={0}
          />
          <span className="text-gray-400">—</span>
          <input
            type="number"
            placeholder={String(Math.ceil(filters.price_range.max))}
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyPriceRange()}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            min={0}
          />
        </div>
        <button
          onClick={applyPriceRange}
          className="mt-2 w-full rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          {t("apply")}
        </button>
      </div>

      {isPending && (
        <div className="text-center text-xs text-gray-400">{t("loading")}</div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile filter toggle */}
      <div className="lg:hidden mb-4">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          {t("mobileToggle")}
          {hasActiveFilters && (
            <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-xs text-white">
              ●
            </span>
          )}
        </button>
        {mobileOpen && (
          <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
            {filterContent}
          </div>
        )}
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 shrink-0">
        <div className="sticky top-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-base font-bold text-gray-900">{t("title")}</h2>
          {filterContent}
        </div>
      </aside>
    </>
  );
}

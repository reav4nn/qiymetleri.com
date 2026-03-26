"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
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

  // Lock body scroll when mobile filter sheet is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const applyFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page");

      setMobileOpen(false);
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

    setMobileOpen(false);
    startTransition(() => {
      router.push(`/${locale}/search?${params.toString()}`);
    });
  }, [router, searchParams, minPrice, maxPrice, startTransition, locale]);

  const clearAllFilters = useCallback(() => {
    const params = new URLSearchParams();
    if (currentQuery) params.set("q", currentQuery);
    setMobileOpen(false);
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
          <span className="text-xs font-medium text-[var(--color-accent)]">
            {t("filtersActive")}
          </span>
          <button
            onClick={clearAllFilters}
            className="text-xs text-[var(--color-danger)] hover:brightness-125 underline"
          >
            {t("clearAll")}
          </button>
        </div>
      )}

      {/* Sort */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-secondary)]">{t("sort")}</h3>
        <select
          value={currentSort}
          onChange={(e) => applyFilter("sort_by", e.target.value)}
          className="w-full rounded-lg border border-[var(--color-border-hover)] bg-[var(--color-bg-input)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
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
        <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-secondary)]">
          {t("category")}
        </h3>
        <div className="space-y-1">
          <button
            onClick={() => applyFilter("category", "")}
            className={`block w-full rounded-md px-3 py-1.5 text-left text-sm transition ${
              !currentCategory
                ? "bg-[var(--color-accent-subtle)] font-medium text-[var(--color-accent)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)]"
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
                  ? "bg-[var(--color-accent-subtle)] font-medium text-[var(--color-accent)]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)]"
              }`}
            >
              <span>
                {CATEGORY_ICONS[cat.id] ? `${CATEGORY_ICONS[cat.id]} ` : ""}
                {tc.has(cat.id) ? tc(cat.id) : cat.name}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">{cat.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Stores */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-secondary)]">{t("store")}</h3>
        <div className="space-y-1">
          <button
            onClick={() => applyFilter("store_id", "")}
            className={`block w-full rounded-md px-3 py-1.5 text-left text-sm transition ${
              !currentStore
                ? "bg-[var(--color-accent-subtle)] font-medium text-[var(--color-accent)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)]"
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
                  ? "bg-[var(--color-accent-subtle)] font-medium text-[var(--color-accent)]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)]"
              }`}
            >
              <span>{store.name}</span>
              <span className="text-xs text-[var(--color-text-muted)]">{store.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Brands */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-secondary)]">{t("brand")}</h3>
        <div className="max-h-56 space-y-1 overflow-y-auto">
          <button
            onClick={() => applyFilter("brand", "")}
            className={`block w-full rounded-md px-3 py-1.5 text-left text-sm transition ${
              !currentBrand
                ? "bg-[var(--color-accent-subtle)] font-medium text-[var(--color-accent)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)]"
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
                  ? "bg-[var(--color-accent-subtle)] font-medium text-[var(--color-accent)]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)]"
              }`}
            >
              <span className="capitalize">{brand.name}</span>
              <span className="text-xs text-[var(--color-text-muted)]">{brand.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-secondary)]">
          {t("priceRange")}
        </h3>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder={String(Math.floor(filters.price_range.min))}
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyPriceRange()}
            className="w-full rounded-lg border border-[var(--color-border-hover)] bg-[var(--color-bg-input)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none"
            min={0}
          />
          <span className="text-[var(--color-text-muted)]">—</span>
          <input
            type="number"
            placeholder={String(Math.ceil(filters.price_range.max))}
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyPriceRange()}
            className="w-full rounded-lg border border-[var(--color-border-hover)] bg-[var(--color-bg-input)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none"
            min={0}
          />
        </div>
        <button
          onClick={applyPriceRange}
          className="mt-2 w-full rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)]"
        >
          {t("apply")}
        </button>
      </div>

      {isPending && (
        <div className="text-center text-xs text-[var(--color-text-muted)]">{t("loading")}</div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile filter toggle */}
      <div className="mb-4 lg:hidden">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-3 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)] active:scale-[0.98]"
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
            <span className="rounded-full bg-[var(--color-accent)] px-1.5 py-0.5 text-xs text-white">
              ●
            </span>
          )}
        </button>
        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <div className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 shadow-2xl animate-in slide-in-from-bottom">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--color-border-hover)]" />
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-bold text-[var(--color-text-primary)]">{t("title")}</h2>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-secondary)]"
                >
                  ✕
                </button>
              </div>
              {filterContent}
            </div>
          </>
        )}
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="sticky top-16 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 shadow-sm">
          <h2 className="mb-4 text-base font-bold text-[var(--color-text-primary)]">{t("title")}</h2>
          {filterContent}
        </div>
      </aside>
    </>
  );
}

"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import type { FilterOptions } from "@/lib/api";

interface FilterPanelProps {
  filters: FilterOptions;
}

type Option = { value: string; label: string };

function FilterCombobox({
  label,
  items,
  value,
  onValueChange,
}: {
  label: string;
  items: Option[];
  value: Option | null;
  onValueChange: (item: Option | null) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Combobox
      inline
      items={items}
      value={value}
      itemToStringValue={(item: Option) => item.label}
      isItemEqualToValue={(a: Option, b: Option) => a.value === b.value}
      open={open}
      onOpenChange={setOpen}
      onValueChange={(item: Option | null) => {
        onValueChange(item);
        setOpen(false);
      }}
    >
      <ComboboxInput
        aria-label={label}
        size="sm"
        className="!border-gray-300 dark:!border-gray-600 !border has-focus-visible:!border-gray-400 dark:has-focus-visible:!border-gray-400 has-focus-visible:!ring-0 [&_input]:text-sm"
      />
      <div
        style={{
          overflow: "hidden",
          maxHeight: open ? "400px" : "0px",
          transition:
            "max-height 300ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <div
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-[var(--color-bg-surface)] mt-1"
          style={{
            opacity: open ? 1 : 0,
            transform: open ? "translateY(0)" : "translateY(-8px)",
            transition:
              "opacity 200ms ease-out 50ms, transform 200ms ease-out 50ms",
          }}
        >
          <ComboboxEmpty>
            <div className="px-2 py-3 text-xs text-[var(--color-text-muted)]">
              No results
            </div>
          </ComboboxEmpty>
          <ComboboxList>
            {(item: Option) => (
              <ComboboxItem key={item.value} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </div>
      </div>
    </Combobox>
  );
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
  const currentChip = searchParams.get("chip") || "";
  const currentSizeMm = searchParams.get("size_mm") || "";

  const [minPrice, setMinPrice] = useState(currentMinPrice);
  const [maxPrice, setMaxPrice] = useState(currentMaxPrice);
  const [mobileOpen, setMobileOpen] = useState(false);

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
    currentChip ||
    currentSizeMm ||
    currentSort !== "name";

  const SORT_OPTIONS: Option[] = [
    { value: "name", label: t("sortNameAZ") },
    { value: "price_asc", label: t("sortPriceAsc") },
    { value: "price_desc", label: t("sortPriceDesc") },
  ];

  const categoryItems: Option[] = [
    { value: "", label: t("all") },
    ...filters.categories.map((cat) => ({
      value: cat.id,
      label: `${tc.has(cat.id) ? tc(cat.id) : cat.name} (${cat.count})`,
    })),
  ];

  const storeItems: Option[] = [
    { value: "", label: t("all") },
    ...filters.stores.map((s) => ({
      value: s.id,
      label: `${s.name} (${s.count})`,
    })),
  ];

  const brandItems: Option[] = [
    { value: "", label: t("all") },
    ...filters.brands.map((b) => ({
      value: b.id,
      label: `${b.name} (${b.count})`,
    })),
  ];

  const currentSortValue = SORT_OPTIONS.find(
    (o) => o.value === currentSort,
  ) ?? null;
  const currentCategoryValue = categoryItems.find(
    (o) => o.value === currentCategory,
  ) ?? null;
  const currentStoreValue = storeItems.find(
    (o) => o.value === currentStore,
  ) ?? null;
  const currentBrandValue = brandItems.find(
    (o) => o.value === currentBrand,
  ) ?? null;

  const chipItems = filters.attributes?.chip?.length
    ? [
        { value: "", label: t("all") },
        ...filters.attributes.chip.map((c) => ({
          value: c.id,
          label: `${c.name} (${c.count})`,
        })),
      ]
    : null;
  const currentChipValue = chipItems?.find((o) => o.value === currentChip) ?? null;

  const sizeItems = filters.attributes?.size_mm?.length
    ? [
        { value: "", label: t("all") },
        ...filters.attributes.size_mm.map((s) => ({
          value: s.id,
          label: `${s.name} (${s.count})`,
        })),
      ]
    : null;
  const currentSizeValue = sizeItems?.find((o) => o.value === currentSizeMm) ?? null;

  const filterContent = (
    <div className="space-y-6">
      {hasActiveFilters && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--color-text-primary)]">
            {t("filtersActive")}
          </span>
          <button
            onClick={clearAllFilters}
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] underline"
          >
            {t("clearAll")}
          </button>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {t("sort")}
        </h3>
        <FilterCombobox
          label={t("sort")}
          items={SORT_OPTIONS}
          value={currentSortValue}
          onValueChange={(item) =>
            applyFilter("sort_by", item?.value ?? "")
          }
        />
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {t("category")}
        </h3>
        <FilterCombobox
          label={t("category")}
          items={categoryItems}
          value={currentCategoryValue}
          onValueChange={(item) =>
            applyFilter("category", item?.value ?? "")
          }
        />
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {t("store")}
        </h3>
        <FilterCombobox
          label={t("store")}
          items={storeItems}
          value={currentStoreValue}
          onValueChange={(item) =>
            applyFilter("store_id", item?.value ?? "")
          }
        />
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {t("brand")}
        </h3>
        <FilterCombobox
          label={t("brand")}
          items={brandItems}
          value={currentBrandValue}
          onValueChange={(item) =>
            applyFilter("brand", item?.value ?? "")
          }
        />
      </div>

      {chipItems && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {t("chip")}
          </h3>
          <FilterCombobox
            label={t("chip")}
            items={chipItems}
            value={currentChipValue}
            onValueChange={(item) =>
              applyFilter("chip", item?.value ?? "")
            }
          />
        </div>
      )}

      {sizeItems && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {t("size")}
          </h3>
          <FilterCombobox
            label={t("size")}
            items={sizeItems}
            value={currentSizeValue}
            onValueChange={(item) =>
              applyFilter("size_mm", item?.value ?? "")
            }
          />
        </div>
      )}

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {t("priceRange")}
        </h3>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder={String(Math.floor(filters.price_range.min))}
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyPriceRange()}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-page)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-border-hover)] focus:outline-none"
            min={0}
          />
          <span className="text-[var(--color-text-muted)]">—</span>
          <input
            type="number"
            placeholder={String(Math.ceil(filters.price_range.max))}
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyPriceRange()}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-page)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-border-hover)] focus:outline-none"
            min={0}
          />
        </div>
        <button
          onClick={applyPriceRange}
          className="mt-2 w-full rounded-lg bg-[var(--color-text-primary)] px-3 py-2 text-sm font-medium text-[var(--color-bg-page)] transition hover:opacity-90"
        >
          {t("apply")}
        </button>
      </div>

      {isPending && (
        <div className="text-center text-xs text-[var(--color-text-muted)]">
          {t("loading")}
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="mb-4 lg:hidden">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-3 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-surface)] active:scale-[0.98]"
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
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-text-primary)]" />
          )}
        </button>
        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <div className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-[var(--color-border)] bg-[var(--color-bg-page)] p-4 shadow-lg">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--color-border)]" />
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                  {t("title")}
                </h2>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-secondary)]"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              {filterContent}
            </div>
          </>
        )}
      </div>

      <aside className="hidden w-56 shrink-0 lg:block">
        <div className="sticky top-16 py-2">
          <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
            {t("title")}
          </h2>
          {filterContent}
        </div>
      </aside>
    </>
  );
}

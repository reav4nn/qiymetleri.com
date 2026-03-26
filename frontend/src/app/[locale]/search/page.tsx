import { Suspense } from "react";
import { fetchProducts, fetchFilters } from "@/lib/api";
import { ProductCard } from "@/components/ProductCard";
import { SearchBar } from "@/components/SearchBar";
import { FilterPanel } from "@/components/FilterPanel";
import { getTranslations, setRequestLocale } from "next-intl/server";

export const revalidate = 300;

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    category?: string;
    brand?: string;
    store_id?: string;
    min_price?: string;
    max_price?: string;
    sort_by?: string;
    page?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("search");
  const sp = await searchParams;
  const query = sp.q || "";
  const category = sp.category || "";
  const brand = sp.brand || "";
  const storeId = sp.store_id || "";
  const minPrice = sp.min_price || "";
  const maxPrice = sp.max_price || "";
  const sortBy = sp.sort_by || "name";
  const page = Number(sp.page) || 1;

  const [data, filters] = await Promise.all([
    fetchProducts({
      q: query || undefined,
      category: category || undefined,
      brand: brand || undefined,
      store_id: storeId || undefined,
      min_price: minPrice ? Number(minPrice) : undefined,
      max_price: maxPrice ? Number(maxPrice) : undefined,
      sort_by: sortBy,
      page,
    }),
    fetchFilters(),
  ]);

  const titleParts: string[] = [];
  if (query) titleParts.push(`"${query}"`);
  if (category) titleParts.push(category);
  if (brand) titleParts.push(brand);
  if (storeId)
    titleParts.push(
      filters.stores.find((s) => s.id === storeId)?.name || storeId
    );

  const title = titleParts.length > 0 ? titleParts.join(" · ") : t("allProducts");

  const totalPages = data.pages;

  return (
    <div className="mx-auto max-w-7xl px-2 py-3 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-3 max-w-xl px-1 sm:mb-6 sm:px-0">
        <SearchBar />
      </div>

      {/* Filters + Products */}
      <div className="lg:flex lg:gap-8">
        <Suspense fallback={null}>
          <FilterPanel filters={filters} />
        </Suspense>

        <div className="min-w-0 flex-1">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <div>
              <h1 className="text-xl font-bold text-[var(--color-text-primary)] sm:text-2xl">{title}</h1>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)] sm:text-sm">
                {t("resultsCount", { total: data.total })}
              </p>
            </div>
          </div>

          <Suspense
            fallback={
              <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-48 animate-pulse rounded-xl bg-[var(--color-bg-surface)]"
                  />
                ))}
              </div>
            }
          >
            <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-3">
              {data.items.map((product) => (
                <ProductCard key={product.id} product={product} locale={locale} />
              ))}
            </div>
          </Suspense>

          {data.items.length === 0 && (
            <div className="mt-12 text-center text-[var(--color-text-secondary)]">
              {t("noResults")}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2 sm:mt-8">
              {page > 1 && (
                <PaginationLink params={sp} page={page - 1} locale={locale}>
                  {t("prev")}
                </PaginationLink>
              )}
              <span className="px-3 py-2 text-sm text-[var(--color-text-secondary)]">
                {page} / {totalPages}
              </span>
              {page < totalPages && (
                <PaginationLink params={sp} page={page + 1} locale={locale}>
                  {t("next")}
                </PaginationLink>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PaginationLink({
  params,
  page,
  locale,
  children,
}: {
  params: Record<string, string | undefined>;
  page: number;
  locale: string;
  children: React.ReactNode;
}) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v && k !== "page") sp.set(k, v);
  });
  sp.set("page", String(page));

  return (
    <a
      href={`/${locale}/search?${sp.toString()}`}
      className="rounded-lg border border-[var(--color-border)] px-5 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-surface-hover)] active:scale-95"
    >
      {children}
    </a>
  );
}

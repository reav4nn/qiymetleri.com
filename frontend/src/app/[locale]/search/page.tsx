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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 max-w-xl">
        <SearchBar />
      </div>

      <div className="flex gap-8">
        <Suspense fallback={null}>
          <FilterPanel filters={filters} />
        </Suspense>

        <div className="min-w-0 flex-1">
          <div className="mb-4 flex items-baseline justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
              <p className="mt-1 text-sm text-gray-500">
                {t("resultsCount", { total: data.total })}
              </p>
            </div>
          </div>

          <Suspense
            fallback={
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-48 animate-pulse rounded-xl bg-gray-100"
                  />
                ))}
              </div>
            }
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.items.map((product) => (
                <ProductCard key={product.id} product={product} locale={locale} />
              ))}
            </div>
          </Suspense>

          {data.items.length === 0 && (
            <div className="mt-12 text-center text-gray-500">
              {t("noResults")}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              {page > 1 && (
                <PaginationLink params={sp} page={page - 1} locale={locale}>
                  {t("prev")}
                </PaginationLink>
              )}
              <span className="px-3 py-2 text-sm text-gray-600">
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
      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
    >
      {children}
    </a>
  );
}

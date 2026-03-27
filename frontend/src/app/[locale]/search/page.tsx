import React, { Suspense } from "react";
import { fetchProducts, fetchFilters } from "@/lib/api";
import { ProductCard } from "@/components/ProductCard";
import { AdBanner } from "@/components/AdBanner";
import { SearchBar } from "@/components/SearchBar";
import { FilterPanel } from "@/components/FilterPanel";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { buildAlternates, ogLocale, absoluteUrl, SITE_NAME } from "@/lib/seo";
import type { Metadata } from "next";

export const revalidate = 300;

type SearchParams = {
  q?: string;
  category?: string;
  brand?: string;
  store_id?: string;
  min_price?: string;
  max_price?: string;
  sort_by?: string;
  page?: string;
};

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "meta" });

  const query = sp.q || "";
  const category = sp.category || "";

  let title: string;
  let description: string;

  if (query) {
    title = t("searchTitle", { query });
    description = t("searchDescription", { query, total: "" });
  } else if (category) {
    title = t("searchCategoryTitle", { category });
    description = t("searchCategoryDescription", { category });
  } else {
    title = t("searchAllTitle");
    description = t("searchAllDescription");
  }

  // Build canonical with only meaningful params (exclude page, sort)
  const canonicalParams = new URLSearchParams();
  if (sp.q) canonicalParams.set("q", sp.q);
  if (sp.category) canonicalParams.set("category", sp.category);
  if (sp.brand) canonicalParams.set("brand", sp.brand);
  const paramStr = canonicalParams.toString();
  const searchPath = `/${locale}/search${paramStr ? `?${paramStr}` : ""}`;

  // noindex deep filter combinations and paginated pages
  const hasDeepFilters =
    (sp.min_price || sp.max_price || sp.store_id) && sp.q;
  const isPaginated = Number(sp.page) > 1;

  return {
    title,
    description,
    alternates: buildAlternates(searchPath),
    openGraph: {
      siteName: SITE_NAME,
      type: "website",
      locale: ogLocale(locale),
      title,
      description,
      url: absoluteUrl(searchPath),
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    robots: {
      index: !hasDeepFilters && !isPaginated,
      follow: true,
    },
  };
}

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
    chip?: string;
    size_mm?: string;
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
  const chip = sp.chip || "";
  const sizeMm = sp.size_mm || "";

  // Context params shared by both products and filters queries
  const contextParams = {
    q: query || undefined,
    category: category || undefined,
    brand: brand || undefined,
    store_id: storeId || undefined,
    min_price: minPrice ? Number(minPrice) : undefined,
    max_price: maxPrice ? Number(maxPrice) : undefined,
  };

  const [data, filters] = await Promise.all([
    fetchProducts({
      ...contextParams,
      sort_by: sortBy,
      page,
      chip: chip || undefined,
      size_mm: sizeMm ? Number(sizeMm) : undefined,
    }),
    fetchFilters(contextParams),
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
              {data.items.map((product, index) => (
                <React.Fragment key={product.id}>
                  <ProductCard product={product} locale={locale} />
                  {index === 5 && data.items.length > 6 && (
                    <div className="col-span-2 lg:col-span-3">
                      <AdBanner
                        slot={process.env.NEXT_PUBLIC_AD_SLOT_SEARCH || ""}
                        format="horizontal"
                        className="my-2 sm:my-4"
                      />
                    </div>
                  )}
                </React.Fragment>
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

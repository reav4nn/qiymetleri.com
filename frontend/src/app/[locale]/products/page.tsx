import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Link } from "@/i18n/navigation";
import {
  getCatalogueData,
  type FilterOption,
} from "@/lib/api";
import { ProductGrid } from "../_components/product-grid";

type SearchParams = Record<string, string | string[] | undefined>;

const categoryTranslationKeys: Record<string, string> = {
  smartphones: "phones",
  laptops: "laptops",
  televisions: "tvs",
  headphones: "headphones",
  tablets: "tablets",
  smartwatches: "watches",
};

function valueOf(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function catalogueHref(
  current: Record<string, string | undefined>,
  updates: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...updates })) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/products?${query}` : "/products";
}

function FilterList({
  title,
  items,
  active,
  hrefFor,
  allLabel,
}: {
  title: string;
  items: FilterOption[];
  active?: string;
  hrefFor: (id?: string) => string;
  allLabel: string;
}) {
  if (items.length === 0) return null;

  return (
    <section>
      <h2 className="mb-2 text-xs font-extrabold tracking-[0.08em] text-[#71717a] uppercase">
        {title}
      </h2>
      <div className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
        <Link
          href={hrefFor()}
          className={`inline-flex min-h-11 items-center justify-between rounded-button px-3 text-sm font-semibold transition-colors ${
            !active
              ? "bg-accent-soft text-accent"
              : "text-[#52525b] hover:bg-[#f4f4f5]"
          }`}
        >
          {allLabel}
        </Link>
        {items.map((item) => (
          <Link
            key={item.id}
            href={hrefFor(item.id)}
            className={`inline-flex min-h-11 items-center justify-between gap-3 rounded-button px-3 text-sm font-semibold transition-colors ${
              active === item.id
                ? "bg-accent-soft text-accent"
                : "text-[#52525b] hover:bg-[#f4f4f5]"
            }`}
          >
            <span className="capitalize">{item.name}</span>
            <span className="text-xs text-[#a1a1aa]">{item.count}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ locale }, rawSearchParams, t] = await Promise.all([
    params,
    searchParams,
    getTranslations(),
  ]);
  const current = {
    q: valueOf(rawSearchParams.q)?.trim(),
    category: valueOf(rawSearchParams.category),
    brand: valueOf(rawSearchParams.brand),
    store_id: valueOf(rawSearchParams.store_id),
    sort_by: valueOf(rawSearchParams.sort_by) ?? "name",
    page: valueOf(rawSearchParams.page) ?? "1",
  };
  const data = await getCatalogueData(current);

  const filters = (
    <div className="space-y-6">
      <FilterList
        title={t("catalogue.categories")}
        items={data.filters.categories.map((item) => ({
          ...item,
          name: categoryTranslationKeys[item.id]
            ? t(`categories.${categoryTranslationKeys[item.id]}`)
            : item.name,
        }))}
        active={current.category}
        allLabel={t("catalogue.all")}
        hrefFor={(category) =>
          catalogueHref(current, { category, page: undefined })
        }
      />
      <FilterList
        title={t("catalogue.brands")}
        items={data.filters.brands}
        active={current.brand}
        allLabel={t("catalogue.all")}
        hrefFor={(brand) => catalogueHref(current, { brand, page: undefined })}
      />
      <FilterList
        title={t("catalogue.stores")}
        items={data.filters.stores}
        active={current.store_id}
        allLabel={t("catalogue.all")}
        hrefFor={(storeId) =>
          catalogueHref(current, { store_id: storeId, page: undefined })
        }
      />
    </div>
  );

  return (
    <>
      <SiteHeader />
      <main className="mx-auto min-h-[60vh] max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8">
        <nav className="mb-4 text-sm text-[#71717a]" aria-label={t("common.breadcrumb")}>
          <Link href="/" className="hover:text-foreground">
            {t("common.home")}
          </Link>
          <span className="mx-2" aria-hidden="true">/</span>
          <span className="text-foreground">{t("catalogue.title")}</span>
        </nav>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">
              {current.q
                ? t("catalogue.searchTitle", { query: current.q })
                : t("catalogue.title")}
            </h1>
            <p className="mt-1 text-sm text-[#71717a]">
              {data.available
                ? t("catalogue.resultCount", { count: data.total })
                : t("home.dataUnavailable")}
            </p>
          </div>

          <form
            action={`/${locale}/products`}
            className="flex min-h-11 items-center gap-2"
          >
            {current.q ? <input type="hidden" name="q" value={current.q} /> : null}
            {current.category ? (
              <input type="hidden" name="category" value={current.category} />
            ) : null}
            {current.brand ? (
              <input type="hidden" name="brand" value={current.brand} />
            ) : null}
            {current.store_id ? (
              <input type="hidden" name="store_id" value={current.store_id} />
            ) : null}
            <label htmlFor="sort_by" className="text-sm font-semibold text-[#52525b]">
              {t("catalogue.sort")}
            </label>
            <select
              id="sort_by"
              name="sort_by"
              defaultValue={current.sort_by}
              className="min-h-11 rounded-button border border-border bg-white px-3 text-sm font-semibold"
            >
              <option value="name">{t("catalogue.sortName")}</option>
              <option value="price_asc">{t("catalogue.sortPriceAsc")}</option>
              <option value="price_desc">{t("catalogue.sortPriceDesc")}</option>
            </select>
            <button
              type="submit"
              className="min-h-11 rounded-button bg-foreground px-4 text-sm font-semibold text-white"
            >
              {t("common.apply")}
            </button>
          </form>
        </div>

        <details className="mb-5 rounded-card border border-border bg-white lg:hidden">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-bold">
            <SlidersHorizontal className="size-4 text-accent" />
            {t("catalogue.filters")}
          </summary>
          <div className="border-t border-border p-4">{filters}</div>
        </details>

        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="hidden self-start rounded-card border border-border bg-white p-4 lg:block">
            {filters}
          </aside>
          <section aria-live="polite">
            <ProductGrid products={data.items} />

            {data.pages > 1 ? (
              <nav
                className="mt-7 flex items-center justify-center gap-2"
                aria-label={t("catalogue.pagination")}
              >
                <Link
                  href={catalogueHref(current, {
                    page: data.page > 2 ? String(data.page - 1) : undefined,
                  })}
                  aria-disabled={data.page <= 1}
                  className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-button border border-border bg-white ${
                    data.page <= 1 ? "pointer-events-none opacity-40" : "hover:border-accent"
                  }`}
                >
                  <ChevronLeft className="size-4" />
                  <span className="sr-only">{t("catalogue.previous")}</span>
                </Link>
                <span className="px-3 text-sm font-semibold">
                  {t("catalogue.page", { page: data.page, pages: data.pages })}
                </span>
                <Link
                  href={catalogueHref(current, { page: String(data.page + 1) })}
                  aria-disabled={data.page >= data.pages}
                  className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-button border border-border bg-white ${
                    data.page >= data.pages
                      ? "pointer-events-none opacity-40"
                      : "hover:border-accent"
                  }`}
                >
                  <ChevronRight className="size-4" />
                  <span className="sr-only">{t("catalogue.next")}</span>
                </Link>
              </nav>
            ) : null}
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

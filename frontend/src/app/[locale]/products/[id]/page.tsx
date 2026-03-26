import { notFound } from "next/navigation";
import { fetchProduct, fetchPriceHistory } from "@/lib/api";
import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import { VariantSelector } from "@/components/VariantSelector";
import { PriceTable } from "@/components/PriceTable";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";

export const revalidate = 300;

const STORE_NAMES: Record<string, string> = {
  kontakt_home: "Kontakt Home",
  baku_electronics: "Baku Electronics",
  irshad_electronics: "Irshad Electronics",
  ispace: "iSpace",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}): Promise<Metadata> {
  const { id, locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  try {
    const product = await fetchProduct(id);
    const allPrices = product.variants
      .flatMap((v) => v.current_prices)
      .filter((p) => p.in_stock)
      .sort((a, b) => Number(a.price_azn) - Number(b.price_azn));
    const lowest = allPrices[0];

    return {
      title: t("productTitle", { name: product.name }),
      description: lowest
        ? t("productDescriptionWithPrice", {
            name: product.name,
            price: Number(lowest.price_azn).toFixed(2),
          })
        : t("productDescriptionDefault", { name: product.name }),
      alternates: {
        languages: {
          az: `/az/products/${id}`,
          ru: `/ru/products/${id}`,
        },
      },
    };
  } catch {
    return { title: t("productNotFound") };
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("product");
  const tt = await getTranslations("table");

  let product;
  let priceHistory;
  try {
    [product, priceHistory] = await Promise.all([
      fetchProduct(id),
      fetchPriceHistory(id, 90),
    ]);
  } catch {
    notFound();
  }

  const allPrices = product.variants
    .flatMap((v) => v.current_prices)
    .filter((p) => p.in_stock)
    .sort((a, b) => Number(a.price_azn) - Number(b.price_azn));
  const lowestPrice = allPrices[0];

  const hasVariants = product.variants.length > 1;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-2 text-sm text-[var(--color-text-secondary)]">
        {product.brand && (
          <span className="capitalize">{product.brand} / </span>
        )}
        {product.category && <span>{product.category}</span>}
      </div>

      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {/* Product image */}
        <div className="flex h-48 w-48 flex-shrink-0 items-center justify-center self-center overflow-hidden rounded-xl bg-[var(--color-bg-surface)] sm:h-56 sm:w-56 sm:self-start">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="h-full w-auto object-contain"
            />
          ) : (
            <svg className="h-16 w-16 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
            </svg>
          )}
        </div>

        <div className="flex-1">
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">{product.name}</h1>

          {lowestPrice && (
            <div className="mt-4">
              <span className="text-sm text-[var(--color-text-secondary)]">{t("lowestPrice")} </span>
              <span className="text-2xl font-bold text-[var(--color-success)]">
                {Number(lowestPrice.price_azn).toFixed(2)} ₼
              </span>
              <span className="ml-2 text-sm text-[var(--color-text-secondary)]">
                ({STORE_NAMES[lowestPrice.store_id] || lowestPrice.store_id})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Variant selector + price table */}
      {hasVariants ? (
        <section className="mt-8">
          <VariantSelector
            variants={product.variants}
            storeNames={STORE_NAMES}
          />
        </section>
      ) : (
        <section className="mt-8">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            {t("priceComparison")}
          </h2>
          <PriceTable
            prices={product.current_prices}
            storeNames={STORE_NAMES}
            labels={{
              store: tt("store"),
              price: tt("price"),
              status: tt("status"),
              inStock: t("inStock"),
              outOfStock: t("outOfStock"),
              goToStore: t("goToStore"),
            }}
          />
        </section>
      )}

      {/* Price history chart */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
          {t("priceHistory")}
        </h2>
        <div className="mt-4">
          <PriceHistoryChart data={priceHistory} />
        </div>
      </section>
    </div>
  );
}

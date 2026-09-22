"use client";

import { useFormatter, useTranslations } from "next-intl";
import { HeartOff, ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { FavouriteButton } from "@/components/favourite-button";
import { useFavourites } from "@/lib/favourites";
import type { ProductSummary } from "@/lib/api";

export function FavouritesClient({
  allProducts,
}: {
  allProducts: ProductSummary[];
}) {
  const t = useTranslations();
  const format = useFormatter();
  const { ids, isFavourite } = useFavourites();

  const favProducts = allProducts.filter((product) => isFavourite(product.id));

  if (favProducts.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-card border border-border bg-white px-6 py-16 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-accent-soft text-accent">
          <HeartOff className="size-8" />
        </div>
        <h2 className="mt-5 text-xl font-extrabold sm:text-2xl">
          {t("favourites.emptyTitle")}
        </h2>
        <p className="mt-2 max-w-md text-sm text-[#71717a]">
          {t("favourites.emptyDesc")}
        </p>
        <Link
          href="/products"
          className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-button bg-accent px-5 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          <span>{t("favourites.explore")}</span>
          <ArrowRight className="size-4" />
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm font-semibold text-[#71717a]">
          {t("favourites.count", { count: favProducts.length })}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {favProducts.map((product) => (
          <Link
            key={product.id}
            href={`/products/${product.id}`}
            className="group relative flex flex-col gap-3 rounded-card border-[1.5px] border-border bg-white p-4 transition-shadow hover:border-[#e4e4e7] hover:shadow-[0_8px_24px_rgba(0,0,0,.08)]"
          >
            <FavouriteButton
              productId={product.id}
              label={t("product.favourite")}
            />

            <div
              className="flex aspect-[4/3] items-center justify-center rounded-button bg-contain bg-center bg-no-repeat sm:aspect-square"
              style={{
                backgroundImage: product.image_url
                  ? `url(${JSON.stringify(product.image_url)})`
                  : "repeating-linear-gradient(45deg, #f4f4f5 0, #f4f4f5 10px, #fafafa 10px, #fafafa 20px)",
              }}
            >
              {!product.image_url ? (
                <span className="font-mono text-[11px] text-[#a1a1aa]">
                  qiymetleri.com
                </span>
              ) : null}
            </div>

            <div className="h-[38px] overflow-hidden text-sm font-semibold leading-[1.35]">
              {product.name}
            </div>

            <div>
              <div className="mb-0.5 text-[11px] font-bold tracking-[0.03em] uppercase text-[#16a34a]">
                {product.lowest_price === null ? t("productPage.outOfStock") : t("product.cheapest")}
              </div>
              <div className="flex items-baseline justify-between">
                <span className={`text-xl font-extrabold tracking-[-0.02em] ${product.lowest_price === null ? "text-sm font-semibold text-[#71717a]" : ""}`}>
                  {product.lowest_price === null
                    ? t("productPage.outOfStock")
                    : `${format.number(product.lowest_price)} ${t("product.unit")}`}
                </span>
                <div className="flex items-center gap-1.5">
                  {product.variant_count > 1 ? (
                    <span className="rounded-md bg-[#f4f4f5] px-2 py-[3px] text-xs font-semibold text-[#52525b]">
                      {product.variant_count} variant
                    </span>
                  ) : null}
                  <span className="rounded-md bg-[#eff6ff] px-2 py-[3px] text-xs font-bold text-[#2563eb]">
                    {t("product.offers", { count: product.store_count })}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

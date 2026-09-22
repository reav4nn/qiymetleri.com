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

            <div className="mt-auto flex flex-col justify-end pt-1">
              <div className="mb-1 min-h-[16px] text-[11px] font-bold tracking-[0.03em] uppercase">
                {product.lowest_price !== null ? (
                  <span className="text-[#16a34a]">{t("product.cheapest")}</span>
                ) : (
                  <span className="invisible">&nbsp;</span>
                )}
              </div>
              <div className="text-xl font-extrabold tracking-[-0.02em] text-foreground whitespace-nowrap">
                {product.lowest_price === null
                  ? t("productPage.outOfStock")
                  : `${format.number(product.lowest_price)} ${t("product.unit")}`}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {product.variant_count > 1 ? (
                  <span className="rounded-md bg-[#f4f4f5] px-2 py-[3px] text-xs font-semibold text-[#52525b] whitespace-nowrap">
                    {product.variant_count} variant
                  </span>
                ) : null}
                <span className="rounded-md bg-[#eff6ff] px-2 py-[3px] text-xs font-bold text-[#2563eb] whitespace-nowrap">
                  {t("product.offers", { count: product.store_count })}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

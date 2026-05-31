"use client";

import Image from "next/image";
import type { Product } from "@/lib/api";
import { useTranslations } from "next-intl";

interface ProductCardProps {
  product: Product;
  locale: string;
}

export function ProductCard({ product, locale }: ProductCardProps) {
  const t = useTranslations("product");

  return (
    <a
      href={`/${locale}/products/${product.id}`}
      className="flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3 shadow-sm transition hover:border-[var(--color-border-hover)] hover:shadow-md active:scale-[0.98] sm:p-4"
    >
      <div className="mb-2 flex h-28 items-center justify-center overflow-hidden rounded-lg bg-[var(--color-bg-page)] p-2 sm:mb-3 sm:h-36">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            width={144}
            height={144}
            className="h-full w-auto object-contain"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--color-text-muted)]">
            <svg className="h-10 w-10 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
            </svg>
          </div>
        )}
      </div>
      <h3 className="text-xs font-medium text-[var(--color-text-primary)] line-clamp-2 sm:text-sm">
        {product.name}
      </h3>
      <div className="mt-1 flex flex-wrap items-center gap-1 sm:gap-2">
        {product.brand && (
          <span className="text-[10px] text-[var(--color-text-secondary)] capitalize sm:text-xs">{product.brand}</span>
        )}
        {product.variant_count > 1 && (
          <span className="text-[10px] text-[var(--color-text-muted)] sm:text-xs">
            {product.variant_count} {t("variant")}
          </span>
        )}
      </div>
      <div className="mt-auto pt-2 sm:pt-3">
        {product.lowest_price ? (
          <div>
            <span className="text-base font-semibold text-[var(--color-text-primary)] sm:text-lg">
              {Number(product.lowest_price).toFixed(2)} ₼
            </span>
            <span className="ml-1 text-[10px] text-[var(--color-text-secondary)] sm:ml-2 sm:text-xs">
              {t("inStores", { count: product.store_count })}
            </span>
          </div>
        ) : (
          <span className="text-xs text-[var(--color-text-muted)] sm:text-sm">{t("noPrice")}</span>
        )}
      </div>
    </a>
  );
}

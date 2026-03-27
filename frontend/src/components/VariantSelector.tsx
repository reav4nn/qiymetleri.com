"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import type { Variant } from "@/lib/api";
import { STORE_LOGOS } from "@/lib/store-logos";

interface VariantSelectorProps {
  variants: Variant[];
  storeNames: Record<string, string>;
}

export function VariantSelector({ variants, storeNames }: VariantSelectorProps) {
  const t = useTranslations("variants");
  const tp = useTranslations("product");
  const tt = useTranslations("table");
  // Extract unique storages and colors
  const storages = useMemo(() => {
    const set = new Set<number>();
    variants.forEach((v) => {
      if (v.storage_gb) set.add(v.storage_gb);
    });
    return [...set].sort((a, b) => a - b);
  }, [variants]);

  const colors = useMemo(() => {
    const set = new Set<string>();
    variants.forEach((v) => {
      if (v.color) set.add(v.color);
    });
    return [...set].sort();
  }, [variants]);

  const [selectedStorage, setSelectedStorage] = useState<number | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  // Filter variants based on selection
  // Variants with null storage/color are shown in all filter states
  const filteredVariants = useMemo(() => {
    return variants.filter((v) => {
      if (selectedStorage && v.storage_gb && v.storage_gb !== selectedStorage)
        return false;
      if (selectedColor && v.color && v.color !== selectedColor) return false;
      return true;
    });
  }, [variants, selectedStorage, selectedColor]);

  // Collect all prices from filtered variants
  const allPrices = useMemo(() => {
    const prices: {
      store_id: string;
      price_azn: number;
      in_stock: boolean;
      url: string | null;
      variant_name: string;
    }[] = [];
    for (const v of filteredVariants) {
      for (const cp of v.current_prices) {
        prices.push({
          store_id: cp.store_id,
          price_azn: Number(cp.price_azn),
          in_stock: cp.in_stock,
          url: cp.url,
          variant_name: v.name,
        });
      }
    }
    return prices.sort((a, b) => a.price_azn - b.price_azn);
  }, [filteredVariants]);

  const formatStorage = (gb: number) => {
    if (gb >= 1024) return `${gb / 1024} TB`;
    return `${gb} GB`;
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">{t("selectVariant")}</h2>

      {/* Storage selector */}
      {storages.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-medium text-[var(--color-text-secondary)]">{t("storage")}</h3>
          <div className="flex flex-wrap gap-2">
            {storages.map((s) => (
              <button
                key={s}
                onClick={() =>
                  setSelectedStorage(selectedStorage === s ? null : s)
                }
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                  selectedStorage === s
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-subtle)] text-[var(--color-accent)]"
                    : "border-[var(--color-border-hover)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-muted)]"
                }`}
              >
                {formatStorage(s)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Color selector */}
      {colors.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-medium text-[var(--color-text-secondary)]">{t("color")}</h3>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() =>
                  setSelectedColor(selectedColor === c ? null : c)
                }
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                  selectedColor === c
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-subtle)] text-[var(--color-accent)]"
                    : "border-[var(--color-border-hover)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-muted)]"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Matching variants count */}
      <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
        {t("matchCount", { variants: filteredVariants.length, offers: allPrices.length })}
      </p>

      {/* Price table */}
      {allPrices.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <table className="w-full min-w-[500px]">
            <thead className="bg-[var(--color-bg-surface)]">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-secondary)]">
                  {tt("store")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-secondary)]">
                  {tt("variant")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-secondary)]">
                  {tt("price")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-secondary)]">
                  {tt("status")}
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {allPrices.map((price, i) => (
                <tr
                  key={`${price.store_id}-${price.variant_name}-${i}`}
                  className={i === 0 ? "bg-[var(--color-success-subtle)]" : ""}
                >
                  <td className="px-4 py-3 text-sm font-medium text-[var(--color-text-primary)]">
                    <span className="inline-flex items-center gap-2">
                      {STORE_LOGOS[price.store_id] && (
                        <img src={STORE_LOGOS[price.store_id]} alt="" className="h-4 w-4 rounded-sm object-contain" />
                      )}
                      {storeNames[price.store_id] || price.store_id}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">
                    {price.variant_name}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-[var(--color-text-primary)]">
                    {price.price_azn.toFixed(2)} ₼
                  </td>
                  <td className="px-4 py-3">
                    {price.in_stock ? (
                      <span className="inline-flex items-center rounded-full bg-[var(--color-success-subtle)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-success)]">
                        {tp("inStock")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-[var(--color-danger-subtle)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-danger)]">
                        {tp("outOfStock")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {price.url && (
                      <a
                        href={price.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="whitespace-nowrap rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-accent-hover)]"
                      >
                        {tp("goToStore")}
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 text-center text-[var(--color-text-muted)]">
          {t("noMatch")}
        </div>
      )}
    </div>
  );
}

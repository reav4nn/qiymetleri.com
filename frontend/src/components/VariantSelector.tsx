"use client";

import { useState, useMemo } from "react";
import type { Variant } from "@/lib/api";

interface VariantSelectorProps {
  variants: Variant[];
  storeNames: Record<string, string>;
}

export function VariantSelector({ variants, storeNames }: VariantSelectorProps) {
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

  const [selectedStorage, setSelectedStorage] = useState<number | null>(
    storages[0] ?? null
  );
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  // Filter variants based on selection
  const filteredVariants = useMemo(() => {
    return variants.filter((v) => {
      if (selectedStorage && v.storage_gb !== selectedStorage) return false;
      if (selectedColor && v.color !== selectedColor) return false;
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
      <h2 className="text-xl font-semibold text-gray-900">Variant seçin</h2>

      {/* Storage selector */}
      {storages.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-medium text-gray-600">Yaddaş</h3>
          <div className="flex flex-wrap gap-2">
            {storages.map((s) => (
              <button
                key={s}
                onClick={() =>
                  setSelectedStorage(selectedStorage === s ? null : s)
                }
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                  selectedStorage === s
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-gray-300 text-gray-700 hover:border-gray-400"
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
          <h3 className="mb-2 text-sm font-medium text-gray-600">Rəng</h3>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() =>
                  setSelectedColor(selectedColor === c ? null : c)
                }
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                  selectedColor === c
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-gray-300 text-gray-700 hover:border-gray-400"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Matching variants count */}
      <p className="mt-4 text-sm text-gray-500">
        {filteredVariants.length} variant, {allPrices.length} təklif tapıldı
      </p>

      {/* Price table */}
      {allPrices.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full min-w-[500px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  Mağaza
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  Variant
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  Qiymət
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {allPrices.map((price, i) => (
                <tr
                  key={`${price.store_id}-${price.variant_name}-${i}`}
                  className={i === 0 ? "bg-green-50" : ""}
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {storeNames[price.store_id] || price.store_id}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {price.variant_name}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-gray-900">
                    {price.price_azn.toFixed(2)} ₼
                  </td>
                  <td className="px-4 py-3">
                    {price.in_stock ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                        Stokda var
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                        Stokda yoxdur
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {price.url && (
                      <a
                        href={price.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="whitespace-nowrap rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                      >
                        Mağazaya keç →
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 text-center text-gray-400">
          Bu seçimə uyğun təklif tapılmadı.
        </div>
      )}
    </div>
  );
}

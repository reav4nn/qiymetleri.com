import type { ProductVariant } from "@/api/types";

export function lowestVariantPrice(variant: ProductVariant): number | null {
  const inStock = variant.current_prices.filter((price) => price.in_stock);
  const pool = inStock.length ? inStock : variant.current_prices;
  return pool.length ? Math.min(...pool.map((price) => price.price_azn)) : null;
}

export function formatVariantLabel(variant: ProductVariant, baseName: string): string {
  if (variant.color) return variant.color;
  let label = variant.name;
  if (baseName && label.toLowerCase().startsWith(baseName.toLowerCase())) {
    label = label.slice(baseName.length).trim().replace(/^[:\-–\s]+/, "");
  }
  if (variant.storage_gb) {
    label = label.replace(new RegExp(`\\b${variant.storage_gb}\\s*GB\\b`, "gi"), "").trim();
  }
  return label || variant.name;
}

export function colorHex(colorName?: string | null): string {
  const value = colorName?.toLocaleLowerCase() ?? "";
  const colors: [string[], string][] = [
    [["black", "qara", "черн"], "#18181b"],
    [["white", "ağ", "aq", "бел"], "#f8fafc"],
    [["titan", "natural", "gray", "grey", "boz", "сер"], "#64748b"],
    [["gold", "qızıl", "золот"], "#eab308"],
    [["silver", "gümüş", "серебр"], "#cbd5e1"],
    [["blue", "mavi", "göy", "син", "голуб"], "#2563eb"],
    [["red", "qırmızı", "красн"], "#dc2626"],
    [["green", "yaşıl", "зелен"], "#16a34a"],
    [["pink", "çəhrayı", "розов"], "#ec4899"],
    [["purple", "bənövşəyi", "фиолет"], "#9333ea"],
    [["yellow", "sarı", "желт"], "#facc15"],
    [["orange", "narıncı", "оранж"], "#ea580c"],
    [["brown", "qəhvəyi", "коричн"], "#78350f"],
  ];
  return colors.find(([tokens]) => tokens.some((token) => value.includes(token)))?.[1] ?? "#94a3b8";
}

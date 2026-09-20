import type { ProductVariant } from "@/api/types";
import { colorHex, formatVariantLabel, lowestVariantPrice } from "@/utils/product-variants";

const variant: ProductVariant = {
  id: "variant-1",
  name: "iPhone 16 Pro 256 GB Desert Titanium",
  storage_gb: 256,
  color: null,
  current_prices: [
    { id: "a", store_id: "one", price_azn: 2500, original_title: null, url: null, in_stock: false, last_checked_at: "2026-01-01" },
    { id: "b", store_id: "two", price_azn: 2700, original_title: null, url: null, in_stock: true, last_checked_at: "2026-01-01" },
    { id: "c", store_id: "three", price_azn: 2600, original_title: null, url: null, in_stock: true, last_checked_at: "2026-01-01" },
  ],
};

test("lowestVariantPrice prefers available offers", () => {
  expect(lowestVariantPrice(variant)).toBe(2600);
});

test("formatVariantLabel removes the family and storage", () => {
  expect(formatVariantLabel(variant, "iPhone 16 Pro")).toBe("Desert Titanium");
});

test("colorHex recognizes Azerbaijani and Russian color names", () => {
  expect(colorHex("Göy")).toBe("#2563eb");
  expect(colorHex("Красный")).toBe("#dc2626");
});

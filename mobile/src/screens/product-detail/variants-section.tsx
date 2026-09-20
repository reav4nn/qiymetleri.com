import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import type { ProductDetail, ProductVariant } from "@/api/types";
import { useLocale } from "@/i18n/locale-context";
import { colors } from "@/theme/colors";
import { colorHex, formatVariantLabel, lowestVariantPrice } from "@/utils/product-variants";

const copy = {
  az: { storage: "Yaddaş / Həcm", colors: "Rənglər", model: "Model / Versiya", from: "-dən", variant: "variant" },
  ru: { storage: "Память / Объём", colors: "Цвета", model: "Модель / Версия", from: "от", variant: "вариантов" },
} as const;

export function VariantsSection({ product }: { product: ProductDetail }) {
  const { formatNumber, locale, t } = useLocale();
  if (product.variants.length <= 1) return null;

  const variantPrices = new Map(product.variants.map((variant) => [variant.id, lowestVariantPrice(variant)]));
  const storageMap = new Map<number | string, ProductVariant[]>();
  const storageMinPrices = new Map<number | string, number>();
  for (const variant of product.variants) {
    const key = variant.storage_gb ?? "other";
    storageMap.set(key, [...(storageMap.get(key) ?? []), variant]);
    const price = variantPrices.get(variant.id);
    if (typeof price === "number" && (storageMinPrices.get(key) === undefined || price < storageMinPrices.get(key)!)) {
      storageMinPrices.set(key, price);
    }
  }

  const storageKeys = [...storageMap.keys()];
  const currentVariant = product.variants.find((variant) => variant.id === product.id);
  const currentStorage = currentVariant?.storage_gb ?? (product.attributes?.storage_gb as number | undefined) ?? "other";
  const activeVariants = storageMap.get(currentStorage) ?? storageMap.get(storageKeys[0]!) ?? product.variants;
  const activeMin = storageMinPrices.get(currentStorage);
  const overallMin = storageMinPrices.size ? Math.min(...storageMinPrices.values()) : null;
  const hasStorage = storageKeys.length > 1 || (storageKeys.length === 1 && storageKeys[0] !== "other");
  const hasColors = activeVariants.some((variant) => Boolean(variant.color));

  return (
    <Section>
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <Text selectable role="heading" aria-level={2} style={{ color: colors.text, fontFamily: "LTSuperiorExtraBold", fontSize: 19 }}>
          {t("productPage.variants")}
        </Text>
        <Text selectable style={{ color: colors.muted, fontFamily: "Manrope", fontSize: 11 }}>
          {product.variants.length} {copy[locale].variant}
        </Text>
      </View>

      {hasStorage ? (
        <View style={{ gap: 8 }}>
          <Label>{copy[locale].storage}</Label>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {storageKeys.map((storage) => {
              const variants = storageMap.get(storage) ?? [];
              const representative = variants.find((variant) => variant.id === product.id) ?? variants[0];
              if (!representative) return null;
              const minPrice = storageMinPrices.get(storage);
              const selected = storage === currentStorage;
              return (
                <Link key={String(storage)} href={{ pathname: "/products/[productId]", params: { productId: representative.id } }} asChild>
                  <Pressable role="link" aria-current={selected ? "page" : undefined} style={({ pressed }) => ({ backgroundColor: selected ? colors.accentSoft : colors.surface, borderColor: selected ? colors.accent : colors.border, borderCurve: "continuous", borderRadius: 12, borderWidth: 1, gap: 2, minHeight: 54, opacity: pressed ? 0.7 : 1, paddingHorizontal: 12, paddingVertical: 8 })}>
                    <Text style={{ color: selected ? colors.accent : colors.text, fontFamily: "Manrope", fontSize: 13, fontWeight: "800" }}>
                      {typeof storage === "number" ? `${storage} GB` : storage}
                      {minPrice === overallMin ? ` · ${t("product.cheapest")}` : ""}
                    </Text>
                    {minPrice !== undefined ? (
                      <Text selectable style={{ color: colors.muted, fontFamily: "Manrope", fontSize: 10 }}>
                        {copy[locale].from} {formatNumber(minPrice)} {t("product.unit")}
                      </Text>
                    ) : null}
                  </Pressable>
                </Link>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        <Label>{hasColors ? copy[locale].colors : copy[locale].model}</Label>
        {activeVariants.map((variant) => {
          const price = variantPrices.get(variant.id) ?? null;
          const selected = variant.id === product.id;
          return (
            <Link key={variant.id} href={{ pathname: "/products/[productId]", params: { productId: variant.id } }} asChild>
              <Pressable role="link" aria-current={selected ? "page" : undefined} style={({ pressed }) => ({ alignItems: "center", backgroundColor: selected ? colors.accentSoft : colors.surface, borderColor: selected ? colors.accent : colors.border, borderCurve: "continuous", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 10, justifyContent: "space-between", minHeight: 54, opacity: pressed ? 0.7 : 1, padding: 12 })}>
                <View style={{ alignItems: "center", flex: 1, flexDirection: "row", gap: 9 }}>
                  {variant.color ? <View aria-hidden style={{ backgroundColor: colorHex(variant.color), borderColor: colors.border, borderRadius: 9, borderWidth: 1, height: 18, width: 18 }} /> : null}
                  <Text numberOfLines={1} style={{ color: selected ? colors.accent : colors.text, flex: 1, fontFamily: "Manrope", fontSize: 12, fontWeight: "800" }}>
                    {formatVariantLabel(variant, product.name)}
                  </Text>
                </View>
                <Text selectable style={{ color: colors.text, fontFamily: "LTSuperiorExtraBold", fontSize: 13 }}>
                  {price === null ? "-" : `${formatNumber(price)} ${t("product.unit")}`}
                  {price !== null && price === activeMin ? ` · ${t("product.cheapest")}` : ""}
                </Text>
              </Pressable>
            </Link>
          );
        })}
      </View>
    </Section>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderCurve: "continuous", borderRadius: 18, borderWidth: 1, gap: 18, padding: 18 }}>{children}</View>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <Text selectable style={{ color: colors.muted, fontFamily: "Manrope", fontSize: 10, fontWeight: "800", textTransform: "uppercase" }}>{children}</Text>;
}

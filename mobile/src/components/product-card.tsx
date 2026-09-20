import type { GestureResponderEvent } from "react-native";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useState } from "react";

import type { ProductSummary } from "@/api/types";
import { useLocale } from "@/i18n/locale-context";
import { colors } from "@/theme/colors";

export function ProductCard({ product, width }: { product: ProductSummary; width: number }) {
  const { formatNumber, t } = useLocale();
  const router = useRouter();
  const [favourite, setFavourite] = useState(false);

  function toggleFavourite(event: GestureResponderEvent) {
    event.stopPropagation();
    setFavourite((value) => !value);
    void Haptics.selectionAsync();
  }

  return (
      <Pressable
        role="link"
        aria-label={product.name}
        onPress={() => router.push({ pathname: "/products/[productId]", params: { productId: product.id } })}
        style={({ pressed }) => ({
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderCurve: "continuous",
          borderRadius: 18,
          borderWidth: 1.5,
          gap: 10,
          opacity: pressed ? 0.76 : 1,
          padding: 12,
          width,
        })}
      >
        <View
          style={{
            alignItems: "center",
            aspectRatio: 1,
            backgroundColor: colors.background,
            borderCurve: "continuous",
            borderRadius: 12,
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {product.image_url ? (
            <Image
              source={{ uri: product.image_url }}
              accessibilityLabel={product.name}
              role="img"
              contentFit="contain"
              transition={180}
              style={{ bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }}
            />
          ) : (
            <Text selectable style={{ color: colors.mutedLight, fontFamily: "Manrope", fontSize: 10 }}>
              qiymetleri.com
            </Text>
          )}
          <Pressable
            role="button"
            aria-label={t("product.favourite")}
            aria-pressed={favourite}
            onPress={toggleFavourite}
            hitSlop={4}
            style={({ pressed }) => ({
              alignItems: "center",
              backgroundColor: favourite ? colors.accentSoft : colors.surface,
              borderColor: favourite ? colors.accent : colors.border,
              borderRadius: 22,
              borderWidth: 1,
              height: 44,
              justifyContent: "center",
              opacity: pressed ? 0.7 : 0.96,
              position: "absolute",
              right: 6,
              top: 6,
              width: 44,
            })}
          >
            <Text aria-hidden style={{ color: favourite ? colors.accent : colors.mutedLight, fontSize: 20 }}>
              {favourite ? "♥" : "♡"}
            </Text>
          </Pressable>
        </View>

        <Text selectable numberOfLines={2} style={{ color: colors.text, fontFamily: "Manrope", fontSize: 13, fontWeight: "700", minHeight: 38 }}>
          {product.name}
        </Text>
        <View style={{ gap: 3 }}>
          <Text selectable style={{ color: colors.price, fontFamily: "Manrope", fontSize: 10, fontWeight: "800" }}>
            {t("product.cheapest")}
          </Text>
          <Text selectable style={{ color: colors.text, fontFamily: "LTSuperiorExtraBold", fontSize: 18 }}>
            {product.lowest_price === null
              ? "-"
              : `${formatNumber(product.lowest_price)} ${t("product.unit")}`}
          </Text>
          <Text selectable style={{ color: "#2563eb", fontFamily: "Manrope", fontSize: 11, fontWeight: "800" }}>
            {t("product.offers", { count: product.store_count })}
          </Text>
        </View>
      </Pressable>
  );
}

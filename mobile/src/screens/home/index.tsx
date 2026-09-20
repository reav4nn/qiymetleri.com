import { Image } from "expo-image";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import type { FilterOption } from "@/api/types";
import { useHomeQuery } from "@/api/queries";
import { ErrorState, LoadingState } from "@/components/async-state";
import { ProductCard } from "@/components/product-card";
import { NetworkBanner } from "@/components/network-banner";
import { SearchField } from "@/components/search-field";
import { useLocale } from "@/i18n/locale-context";
import { colors } from "@/theme/colors";

const categories = [
  ["smartphones", "phones", "📱", "#fff1f2"],
  ["laptops", "laptops", "💻", "#eff6ff"],
  ["televisions", "tvs", "📺", "#f0fdf4"],
  ["headphones", "headphones", "🎧", "#faf5ff"],
  ["tablets", "tablets", "▣", "#fff7ed"],
  ["smartwatches", "watches", "⌚", "#f0fdfa"],
] as const;

const storeLogos: Record<string, number> = {
  kontakt_home: require("@/assets/stores/kontakt_home.png"),
  baku_electronics: require("@/assets/stores/baku_electronics.png"),
  irshad_electronics: require("@/assets/stores/irshad_electronics.png"),
  ispace: require("@/assets/stores/ispace.png"),
};

export function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { data, error, isPending, isRefetching, refetch } = useHomeQuery();
  const { t } = useLocale();
  const [search, setSearch] = useState("");
  const contentWidth = Math.min(width, 720) - 32;
  const cardWidth = Math.max(148, (contentWidth - 12) / 2);

  function submitSearch() {
    const q = search.trim();
    router.push({ pathname: "/products", params: q ? { q } : {} });
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={colors.accent} />
      }
      contentContainerStyle={{ alignSelf: "center", gap: 22, maxWidth: 720, padding: 16, paddingBottom: 36, width: "100%" }}
    >
      <SearchField
        value={search}
        onChangeText={setSearch}
        onSubmit={submitSearch}
        placeholder={t("search.placeholder")}
        submitLabel={t("search.submit")}
      />
      <NetworkBanner
        dataSource={data?.dataSource}
        snapshotGeneratedAt={data?.snapshotGeneratedAt}
      />

      <View style={{ gap: 12 }}>
        <Text selectable role="heading" aria-level={1} style={{ color: colors.text, fontFamily: "LTSuperiorExtraBold", fontSize: 22 }}>
          {t("home.hero")}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {categories.map(([id, key, icon, iconBackground]) => {
            const count = data?.categories.find((item) => item.id === id)?.count ?? 0;
            return (
                <Pressable
                  key={id}
                  role="link"
                  aria-label={t(`categories.${key}`)}
                  onPress={() => router.push({ pathname: "/products", params: { category: id } })}
                  style={({ pressed }) => ({
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderCurve: "continuous",
                    borderRadius: 16,
                    borderWidth: 1.5,
                    flexBasis: "47%",
                    flexGrow: 1,
                    gap: 8,
                    minHeight: 112,
                    opacity: pressed ? 0.72 : 1,
                    padding: 14,
                  })}
                >
                  <View style={{ alignItems: "center", backgroundColor: iconBackground, borderRadius: 12, height: 42, justifyContent: "center", width: 42 }}>
                    <Text aria-hidden style={{ fontSize: 22 }}>{icon}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 6, justifyContent: "space-between" }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ color: colors.text, fontFamily: "Manrope", fontSize: 13, fontWeight: "800" }}>
                        {t(`categories.${key}`)}
                      </Text>
                      <Text selectable style={{ color: colors.mutedLight, fontFamily: "Manrope", fontSize: 11, fontVariant: ["tabular-nums"] }}>
                        {t("categories.count", { count })}
                      </Text>
                    </View>
                    <Text aria-hidden style={{ color: colors.mutedLight, fontSize: 18 }}>›</Text>
                  </View>
                </Pressable>
            );
          })}
        </View>
      </View>

      {isPending ? <LoadingState label={t("home.popularTitle")} /> : null}
      {error && !data ? (
        <ErrorState message={t("home.dataUnavailable")} retryLabel={t("common.apply")} onRetry={() => void refetch()} />
      ) : null}
      {data ? (
        <>
          <StoresBar stores={data.stores} />
          <View style={{ gap: 12 }}>
            <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
              <Text selectable role="heading" aria-level={2} style={{ color: colors.text, fontFamily: "LTSuperiorExtraBold", fontSize: 20 }}>
                {t("home.popularTitle")}
              </Text>
              <Link href="/products" asChild>
                <Pressable role="link" style={{ minHeight: 44, justifyContent: "center" }}>
                  <Text style={{ color: colors.accent, fontFamily: "Manrope", fontWeight: "800" }}>
                    {t("home.seeAll")}
                  </Text>
                </Pressable>
              </Link>
            </View>
            {data.products.length ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                {data.products.map((product) => (
                  <ProductCard key={product.id} product={product} width={cardWidth} />
                ))}
              </View>
            ) : (
              <Text selectable style={{ color: colors.muted, fontFamily: "Manrope", paddingVertical: 24, textAlign: "center" }}>
                {t("home.emptyProducts")}
              </Text>
            )}
          </View>
        </>
      ) : null}

      <View style={{ borderTopColor: colors.border, borderTopWidth: 1, gap: 6, paddingTop: 20 }}>
        <Text selectable style={{ color: colors.muted, fontFamily: "Manrope", fontSize: 12 }}>
          {t("footer.tagline")}
        </Text>
        <Text selectable style={{ color: colors.mutedLight, fontFamily: "Manrope", fontSize: 11 }}>
          {t("footer.copyright", { year: 2026 })}
        </Text>
      </View>
    </ScrollView>
  );
}

function StoresBar({ stores }: { stores: FilterOption[] }) {
  const { t } = useLocale();
  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderCurve: "continuous", borderRadius: 18, borderWidth: 1.5, gap: 12, padding: 16 }}>
      <Text selectable style={{ color: colors.muted, fontFamily: "Manrope", fontSize: 13, fontWeight: "800" }}>
        {t("home.storesLabel")}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
        {stores.map((store) => (
          <View key={store.id} style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
            <Image source={storeLogos[store.id] ?? require("@/assets/brand/logo.svg")} accessibilityLabel={store.name} role="img" contentFit="contain" style={{ borderRadius: 4, height: 20, width: 20 }} />
            <Text selectable style={{ color: colors.text, fontFamily: "Manrope", fontSize: 12, fontWeight: "800" }}>
              {store.name}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

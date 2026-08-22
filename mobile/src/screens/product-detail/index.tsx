import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { Link } from "expo-router";
import { Stack } from "expo-router/stack";
import { useState } from "react";
import { Linking, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

import type { CurrentPrice, PriceHistoryPoint, ProductDetail } from "@/api/types";
import { ResourceNotFoundError } from "@/api/client";
import { useProductQuery } from "@/api/queries";
import { LoadingState } from "@/components/async-state";
import { NetworkBanner } from "@/components/network-banner";
import { NotFoundScreen } from "@/screens/not-found";
import { useLocale } from "@/i18n/locale-context";
import { colors } from "@/theme/colors";
import { safeExternalUrl } from "@/utils/external-url";
import { VariantsSection } from "@/screens/product-detail/variants-section";

const categoryTranslationKeys: Record<string, string> = {
  smartphones: "phones",
  laptops: "laptops",
  televisions: "tvs",
  headphones: "headphones",
  tablets: "tablets",
  smartwatches: "watches",
};

export function ProductDetailScreen({ productId }: { productId?: string }) {
  const query = useProductQuery(productId);
  const { t } = useLocale();

  if (query.isPending) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
        <LoadingState label={t("productPage.stores")} />
      </ScrollView>
    );
  }
  if (query.error instanceof ResourceNotFoundError) return <NotFoundScreen />;
  if (query.error || !query.data) {
    return (
      <>
        <Stack.Title>{t("productPage.unavailableTitle")}</Stack.Title>
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ alignItems: "center", flexGrow: 1, justifyContent: "center", padding: 24 }}>
          <View role="alert" style={{ alignItems: "center", gap: 14, maxWidth: 560 }}>
            <Text selectable role="heading" aria-level={1} style={{ color: colors.text, fontFamily: "LTSuperiorExtraBold", fontSize: 25, textAlign: "center" }}>
              {t("productPage.unavailableTitle")}
            </Text>
            <Text selectable style={{ color: colors.muted, fontFamily: "Manrope", lineHeight: 22, textAlign: "center" }}>
              {t("productPage.unavailableBody")}
            </Text>
            <Link href="/products" asChild>
              <Pressable role="link" style={({ pressed }) => ({ backgroundColor: colors.accent, borderCurve: "continuous", borderRadius: 12, justifyContent: "center", minHeight: 46, opacity: pressed ? 0.72 : 1, paddingHorizontal: 20 })}>
                <Text style={{ color: colors.surface, fontFamily: "Manrope", fontWeight: "800" }}>
                  {t("productPage.backToCatalogue")}
                </Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </>
    );
  }

  const { history, product, stores } = query.data;
  const storeNames = new Map(stores.map((store) => [store.id, store.name]));
  const prices = [...product.current_prices].sort((left, right) => left.price_azn - right.price_azn);
  const lowestPrice = prices.find((price) => price.in_stock)?.price_azn ?? null;

  return (
    <>
      <Stack.Title>{product.name}</Stack.Title>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.accent} />}
        contentContainerStyle={{ alignSelf: "center", gap: 16, maxWidth: 720, padding: 16, paddingBottom: 36, width: "100%" }}
      >
        <NetworkBanner
          dataSource={query.data.dataSource}
          snapshotGeneratedAt={query.data.snapshotGeneratedAt}
        />
        <ProductHero product={product} lowestPrice={lowestPrice} offerCount={prices.length} />
        <OffersSection prices={prices} storeNames={storeNames} />
        <VariantsSection product={product} />
        <AttributesSection product={product} />
        <HistorySection history={history} storeNames={storeNames} />
      </ScrollView>
    </>
  );
}

function ProductHero({ product, lowestPrice, offerCount }: { product: ProductDetail; lowestPrice: number | null; offerCount: number }) {
  const { formatDate, formatNumber, t } = useLocale();
  const [favourite, setFavourite] = useState(false);
  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderCurve: "continuous", borderRadius: 20, borderWidth: 1, gap: 16, padding: 16 }}>
      <View style={{ alignItems: "center", aspectRatio: 1.18, backgroundColor: colors.background, borderCurve: "continuous", borderRadius: 16, justifyContent: "center", overflow: "hidden" }}>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} accessibilityLabel={product.name} role="img" contentFit="contain" transition={180} style={{ bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }} />
        ) : (
          <Text selectable style={{ color: colors.mutedLight, fontFamily: "Manrope" }}>qiymetleri.com</Text>
        )}
        <Pressable role="button" aria-label={t("product.favourite")} aria-pressed={favourite} onPress={() => { setFavourite((value) => !value); void Haptics.selectionAsync(); }} style={({ pressed }) => ({ alignItems: "center", backgroundColor: favourite ? colors.accentSoft : colors.surface, borderColor: favourite ? colors.accent : colors.border, borderRadius: 24, borderWidth: 1, height: 48, justifyContent: "center", opacity: pressed ? 0.7 : 0.95, position: "absolute", right: 10, top: 10, width: 48 })}>
          <Text aria-hidden style={{ color: favourite ? colors.accent : colors.mutedLight, fontSize: 23 }}>{favourite ? "♥" : "♡"}</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {product.brand ? <Badge label={product.brand} /> : null}
        {product.category ? (
          <Link href={{ pathname: "/products", params: { category: product.category } }} asChild>
            <Pressable role="link" style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Badge label={categoryTranslationKeys[product.category] ? t(`categories.${categoryTranslationKeys[product.category]}`) : product.category} accent />
            </Pressable>
          </Link>
        ) : null}
      </View>
      <Text selectable role="heading" aria-level={1} style={{ color: colors.text, fontFamily: "LTSuperiorExtraBold", fontSize: 27 }}>
        {product.name}
      </Text>
      <Text selectable style={{ color: colors.muted, fontFamily: "Manrope", fontSize: 12 }}>{product.canonical_id}</Text>
      <View style={{ backgroundColor: "#f8fafc", borderCurve: "continuous", borderRadius: 16, gap: 4, padding: 16 }}>
        <Text selectable style={{ color: colors.price, fontFamily: "Manrope", fontSize: 11, fontWeight: "800" }}>{t("product.cheapest")}</Text>
        <Text selectable style={{ color: colors.text, fontFamily: "LTSuperiorExtraBold", fontSize: 30 }}>
          {lowestPrice === null ? "-" : `${formatNumber(lowestPrice)} ${t("product.unit")}`}
        </Text>
        <Text selectable style={{ color: colors.muted, fontFamily: "Manrope", fontSize: 12 }}>{t("productPage.offerSummary", { count: offerCount })}</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Metric label={t("productPage.stores")} value={String(offerCount)} />
        <Metric label={t("productPage.updated")} value={formatDate(new Date(product.updated_at), { day: "2-digit", month: "short" })} />
      </View>
      <Text selectable style={{ backgroundColor: colors.accentSoft, borderCurve: "continuous", borderRadius: 12, color: colors.muted, fontFamily: "Manrope", fontSize: 12, lineHeight: 19, padding: 13 }}>
        {t("productPage.priceNotice")}
      </Text>
    </View>
  );
}

function OffersSection({ prices, storeNames }: { prices: CurrentPrice[]; storeNames: Map<string, string> }) {
  const { formatNumber, t } = useLocale();
  return (
    <Section title={t("productPage.offersTitle")}>
      {prices.length ? prices.map((price, index) => (
        <View key={price.id} style={{ borderColor: colors.border, borderCurve: "continuous", borderRadius: 14, borderWidth: 1, gap: 10, padding: 14 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "space-between" }}>
            <Text selectable style={{ color: colors.text, flex: 1, fontFamily: "Manrope", fontWeight: "800" }}>{storeNames.get(price.store_id) ?? price.store_id}</Text>
            {index === 0 && price.in_stock ? <Badge label={t("product.cheapest")} success /> : null}
          </View>
          <Text selectable style={{ color: price.in_stock ? colors.price : colors.mutedLight, fontFamily: "Manrope", fontSize: 11, fontWeight: "800" }}>
            {price.in_stock ? t("productPage.inStock") : t("productPage.outOfStock")}
          </Text>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between" }}>
            <Text selectable style={{ color: colors.text, fontFamily: "LTSuperiorExtraBold", fontSize: 23 }}>{formatNumber(price.price_azn)} {t("product.unit")}</Text>
            {safeHttpUrl(price.url) ? (
              <Pressable role="link" aria-label={`${t("productPage.goToStore")} ${storeNames.get(price.store_id) ?? price.store_id}`} onPress={() => void Linking.openURL(safeHttpUrl(price.url)!)} style={({ pressed }) => ({ backgroundColor: colors.accent, borderCurve: "continuous", borderRadius: 12, justifyContent: "center", minHeight: 46, opacity: pressed ? 0.7 : 1, paddingHorizontal: 14 })}>
                <Text style={{ color: colors.surface, fontFamily: "Manrope", fontSize: 12, fontWeight: "800" }}>{t("productPage.goToStore")} ↗</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      )) : <Text selectable style={{ color: colors.muted, fontFamily: "Manrope", padding: 10 }}>{t("productPage.noOffers")}</Text>}
    </Section>
  );
}

function AttributesSection({ product }: { product: ProductDetail }) {
  const { t } = useLocale();
  const attributes = Object.entries(product.attributes ?? {}).filter(([, value]) => value !== null && value !== undefined);
  if (!attributes.length) return null;
  const labels: Record<string, string> = {
    storage_gb: t("productPage.attributes.storage"),
    color: t("productPage.attributes.color"),
    chip: t("productPage.attributes.chip"),
    size_mm: t("productPage.attributes.watchSize"),
    size_inch: t("productPage.attributes.screenSize"),
  };
  return (
    <Section title={t("productPage.features")}>
      {attributes.map(([key, value]) => (
        <View key={key} style={{ borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: "row", gap: 16, justifyContent: "space-between", paddingVertical: 10 }}>
          <Text selectable style={{ color: colors.muted, flex: 1, fontFamily: "Manrope", fontSize: 12 }}>{labels[key] ?? key.replaceAll("_", " ")}</Text>
          <Text selectable style={{ color: colors.text, flex: 1, fontFamily: "Manrope", fontSize: 12, fontWeight: "800", textAlign: "right" }}>
            {String(value)}{key === "storage_gb" ? " GB" : key === "size_mm" ? " mm" : key === "size_inch" ? "″" : ""}
          </Text>
        </View>
      ))}
    </Section>
  );
}

function HistorySection({ history, storeNames }: { history: PriceHistoryPoint[]; storeNames: Map<string, string> }) {
  const { formatDate, formatNumber, t } = useLocale();
  const prices = history.map((point) => point.price_azn);
  const min = prices.length ? Math.min(...prices) : null;
  const max = prices.length ? Math.max(...prices) : null;
  return (
    <Section title={t("productPage.historyTitle")}>
      <Text selectable style={{ color: colors.muted, fontFamily: "Manrope", fontSize: 12 }}>{t("productPage.historyBody")}</Text>
      {min !== null && max !== null ? <Text selectable style={{ color: colors.text, fontFamily: "Manrope", fontWeight: "800" }}>{formatNumber(min)}–{formatNumber(max)} {t("product.unit")}</Text> : null}
      {history.length ? history.slice(-8).reverse().map((point) => (
        <View key={`${point.product_id}-${point.store_id}-${point.time}`} style={{ borderTopColor: colors.border, borderTopWidth: 1, gap: 4, paddingTop: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text selectable style={{ color: colors.text, fontFamily: "Manrope", fontSize: 12, fontWeight: "800" }}>{storeNames.get(point.store_id) ?? point.store_id}</Text>
            <Text selectable style={{ color: colors.text, fontFamily: "LTSuperiorExtraBold", fontSize: 13 }}>{formatNumber(point.price_azn)} {t("product.unit")}</Text>
          </View>
          <Text selectable style={{ color: colors.muted, fontFamily: "Manrope", fontSize: 11 }}>{formatDate(new Date(point.time), { day: "2-digit", month: "short", year: "numeric" })}</Text>
        </View>
      )) : <Text selectable style={{ color: colors.muted, fontFamily: "Manrope", paddingVertical: 10 }}>{t("productPage.noHistory")}</Text>}
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderCurve: "continuous", borderRadius: 18, borderWidth: 1, gap: 12, padding: 18 }}><Text selectable role="heading" aria-level={2} style={{ color: colors.text, fontFamily: "LTSuperiorExtraBold", fontSize: 20 }}>{title}</Text>{children}</View>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={{ borderColor: colors.border, borderCurve: "continuous", borderRadius: 13, borderWidth: 1, flex: 1, gap: 4, padding: 12 }}><Text selectable style={{ color: colors.text, fontFamily: "LTSuperiorExtraBold", fontSize: 16 }}>{value}</Text><Text selectable style={{ color: colors.muted, fontFamily: "Manrope", fontSize: 10 }}>{label}</Text></View>;
}

function Badge({ label, accent, success }: { label: string; accent?: boolean; success?: boolean }) {
  return <Text selectable style={{ backgroundColor: success ? "#dcfce7" : accent ? colors.accentSoft : colors.background, borderCurve: "continuous", borderRadius: 8, color: success ? "#15803d" : accent ? colors.accent : colors.muted, fontFamily: "Manrope", fontSize: 10, fontWeight: "800", overflow: "hidden", paddingHorizontal: 9, paddingVertical: 6 }}>{label}</Text>;
}

function safeHttpUrl(value: string | null) {
  const url = safeExternalUrl(value);
  return url?.startsWith("http:") || url?.startsWith("https:") ? url : null;
}

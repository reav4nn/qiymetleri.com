import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import type { CatalogueQuery, FilterOption, ProductSummary } from "@/api/types";
import { useCatalogueQuery } from "@/api/queries";
import { LoadingState } from "@/components/async-state";
import { ProductCard } from "@/components/product-card";
import { NetworkBanner } from "@/components/network-banner";
import { SearchField } from "@/components/search-field";
import { useLocale } from "@/i18n/locale-context";
import { colors } from "@/theme/colors";

const categoryTranslationKeys: Record<string, string> = {
  smartphones: "phones",
  laptops: "laptops",
  televisions: "tvs",
  headphones: "headphones",
  tablets: "tablets",
  smartwatches: "watches",
};

const sortOptions: { id: NonNullable<CatalogueQuery["sort_by"]>; key: string }[] = [
  { id: "name", key: "catalogue.sortName" },
  { id: "price_asc", key: "catalogue.sortPriceAsc" },
  { id: "price_desc", key: "catalogue.sortPriceDesc" },
];

export function CatalogueScreen({
  query,
  onUpdateQuery,
}: {
  query: CatalogueQuery;
  onUpdateQuery: (updates: Partial<CatalogueQuery>) => void;
}) {
  const { width } = useWindowDimensions();
  const { data, error, isFetching, isPending, isRefetching, refetch } = useCatalogueQuery(query);
  const { t } = useLocale();
  const [search, setSearch] = useState(query.q ?? "");
  const [filtersExpanded, setFiltersExpanded] = useState(Boolean(query.category || query.brand || query.store_id));
  const contentWidth = Math.min(width, 720) - 32;
  const cardWidth = Math.max(148, (contentWidth - 12) / 2);

  const activeFilterCount = [query.category, query.brand, query.store_id].filter(Boolean).length;
  const header = (
    <View style={{ gap: 16, paddingBottom: 18 }}>
      <SearchField
        value={search}
        onChangeText={setSearch}
        onSubmit={() => onUpdateQuery({ q: search.trim() || undefined, page: 1 })}
        placeholder={t("search.placeholder")}
        submitLabel={t("search.submit")}
      />
      <NetworkBanner
        dataSource={data?.dataSource}
        snapshotGeneratedAt={data?.snapshotGeneratedAt}
      />
      <View>
        <Text selectable role="heading" aria-level={1} style={{ color: colors.text, fontFamily: "LTSuperiorExtraBold", fontSize: 24 }}>
          {query.q ? t("catalogue.searchTitle", { query: query.q }) : t("catalogue.title")}
        </Text>
        {data || error ? (
          <Text
            selectable
            role={error ? "alert" : undefined}
            style={{ color: colors.muted, fontFamily: "Manrope", fontSize: 13, paddingTop: 4 }}
          >
            {data ? t("catalogue.resultCount", { count: data.total }) : t("home.dataUnavailable")}
          </Text>
        ) : null}
      </View>

      <FilterRow
        title={t("catalogue.sort")}
        items={sortOptions.map((item) => ({ id: item.id, name: t(item.key), count: 0 }))}
        active={query.sort_by}
        showCount={false}
        onSelect={(sort_by) => onUpdateQuery({ sort_by: sort_by as CatalogueQuery["sort_by"], page: 1 })}
      />

      {data ? (
        <>
          <Pressable
            role="button"
            aria-expanded={filtersExpanded}
            onPress={() => setFiltersExpanded((value) => !value)}
            style={({ pressed }) => ({
              alignItems: "center",
              backgroundColor: filtersExpanded ? colors.accentSoft : colors.surface,
              borderColor: filtersExpanded ? colors.accent : colors.border,
              borderCurve: "continuous",
              borderRadius: 14,
              borderWidth: 1.5,
              flexDirection: "row",
              justifyContent: "space-between",
              minHeight: 48,
              opacity: pressed ? 0.72 : 1,
              paddingHorizontal: 15,
            })}
          >
            <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
              <Text aria-hidden style={{ color: colors.accent, fontSize: 17 }}>☷</Text>
              <Text style={{ color: colors.text, fontFamily: "Manrope", fontSize: 13, fontWeight: "800" }}>
                {t("catalogue.filters")}
              </Text>
              {activeFilterCount ? (
                <Text selectable style={{ backgroundColor: colors.accent, borderRadius: 10, color: colors.surface, fontFamily: "Manrope", fontSize: 10, fontVariant: ["tabular-nums"], fontWeight: "800", overflow: "hidden", paddingHorizontal: 7, paddingVertical: 3 }}>
                  {activeFilterCount}
                </Text>
              ) : null}
            </View>
            <Text aria-hidden style={{ color: colors.muted, fontSize: 18 }}>{filtersExpanded ? "⌃" : "⌄"}</Text>
          </Pressable>

          {filtersExpanded ? (
            <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderCurve: "continuous", borderRadius: 16, borderWidth: 1, gap: 16, padding: 14 }}>
              <FilterRow
                title={t("catalogue.categories")}
                items={data.filters.categories.map((item) => ({
                  ...item,
                  name: categoryTranslationKeys[item.id]
                    ? t(`categories.${categoryTranslationKeys[item.id]}`)
                    : item.name,
                }))}
                active={query.category}
                allLabel={t("catalogue.all")}
                onSelect={(category) => onUpdateQuery({ category, page: 1 })}
              />
              <FilterRow
                title={t("catalogue.brands")}
                items={data.filters.brands}
                active={query.brand}
                allLabel={t("catalogue.all")}
                onSelect={(brand) => onUpdateQuery({ brand, page: 1 })}
              />
              <FilterRow
                title={t("catalogue.stores")}
                items={data.filters.stores}
                active={query.store_id}
                allLabel={t("catalogue.all")}
                onSelect={(store_id) => onUpdateQuery({ store_id, page: 1 })}
              />
            </View>
          ) : null}
        </>
      ) : null}
      {isFetching && !isRefetching && data ? <ActivityIndicator color={colors.accent} /> : null}
    </View>
  );

  return (
    <FlatList<ProductSummary>
      data={data?.items ?? []}
      keyExtractor={(item) => item.id}
      numColumns={2}
      renderItem={({ item }) => <ProductCard product={item} width={cardWidth} />}
      columnWrapperStyle={{ gap: 12 }}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      ListHeaderComponent={header}
      ListEmptyComponent={
        isPending ? (
          <LoadingState label={t("catalogue.title")} />
        ) : error ? (
          null
        ) : (
          <Text selectable style={{ color: colors.muted, fontFamily: "Manrope", padding: 32, textAlign: "center" }}>
            {t("home.emptyProducts")}
          </Text>
        )
      }
      ListFooterComponent={
        data && data.pages > 1 ? (
          <Pagination
            page={data.page}
            pages={data.pages}
            previousLabel={t("catalogue.previous")}
            nextLabel={t("catalogue.next")}
            pageLabel={t("catalogue.page", { page: data.page, pages: data.pages })}
            onPage={(page) => onUpdateQuery({ page })}
          />
        ) : null
      }
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={colors.accent} />}
      contentContainerStyle={{ alignSelf: "center", flexGrow: 1, maxWidth: 720, padding: 16, paddingBottom: 32, width: "100%" }}
    />
  );
}

function FilterRow({
  title,
  items,
  active,
  allLabel,
  showCount = true,
  onSelect,
}: {
  title: string;
  items: FilterOption[];
  active?: string;
  allLabel?: string;
  showCount?: boolean;
  onSelect: (id?: string) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text selectable role="heading" aria-level={2} style={{ color: colors.muted, fontFamily: "Manrope", fontSize: 11, fontWeight: "800", textTransform: "uppercase" }}>
        {title}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {allLabel ? <FilterChip label={allLabel} selected={!active} onPress={() => onSelect(undefined)} /> : null}
        {items.map((item) => (
          <FilterChip
            key={item.id}
            label={showCount ? `${item.name} · ${item.count}` : item.name}
            selected={active === item.id}
            onPress={() => onSelect(active === item.id && allLabel ? undefined : item.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      role="button"
      aria-pressed={selected}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: selected ? colors.accentSoft : colors.surface,
        borderColor: selected ? colors.accent : colors.border,
        borderCurve: "continuous",
        borderRadius: 14,
        borderWidth: 1,
        justifyContent: "center",
        minHeight: 44,
        opacity: pressed ? 0.7 : 1,
        paddingHorizontal: 14,
      })}
    >
      <Text style={{ color: selected ? colors.accent : colors.muted, fontFamily: "Manrope", fontSize: 12, fontWeight: "800" }}>
        {label}
      </Text>
    </Pressable>
  );
}

function Pagination({ page, pages, previousLabel, nextLabel, pageLabel, onPage }: { page: number; pages: number; previousLabel: string; nextLabel: string; pageLabel: string; onPage: (page: number) => void }) {
  return (
    <View role="navigation" aria-label={pageLabel} style={{ alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "center", paddingTop: 24 }}>
      <PageButton label={previousLabel} direction="previous" disabled={page <= 1} onPress={() => onPage(page - 1)} />
      <Text selectable style={{ color: colors.muted, fontFamily: "Manrope", fontVariant: ["tabular-nums"] }}>
        {pageLabel}
      </Text>
      <PageButton label={nextLabel} direction="next" disabled={page >= pages} onPress={() => onPage(page + 1)} />
    </View>
  );
}

function PageButton({ label, direction, disabled, onPress }: { label: string; direction: "previous" | "next"; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable role="button" aria-label={label} aria-disabled={disabled} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 12, borderWidth: 1, height: 44, justifyContent: "center", opacity: disabled ? 0.35 : pressed ? 0.7 : 1, width: 48 })}>
      <Text aria-hidden style={{ color: colors.text, fontSize: 20 }}>{direction === "next" ? "›" : "‹"}</Text>
    </Pressable>
  );
}

import {
  BarChart3,
  ChevronRight,
  Clock3,
  ExternalLink,
  ShieldCheck,
  Store,
  TrendingDown,
} from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { FavouriteButton } from "@/components/favourite-button";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Link } from "@/i18n/navigation";
import { getProductPageData, type CurrentPrice } from "@/lib/api";

const categoryTranslationKeys: Record<string, string> = {
  smartphones: "phones",
  laptops: "laptops",
  televisions: "tvs",
  headphones: "headphones",
  tablets: "tablets",
  smartwatches: "watches",
};

function safeRetailerUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function getColorHex(colorName?: string | null): string {
  if (!colorName) return "#94a3b8";
  const str = colorName.toLowerCase();

  if (str.includes("black") || str.includes("qara") || str.includes("черн")) return "#18181b";
  if (str.includes("white") || str.includes("ağ") || str.includes("aq") || str.includes("бел")) return "#f8fafc";
  if (str.includes("titan") || str.includes("natural") || str.includes("gray") || str.includes("grey") || str.includes("boz") || str.includes("сер")) return "#64748b";
  if (str.includes("gold") || str.includes("qızıl") || str.includes("золот")) return "#eab308";
  if (str.includes("silver") || str.includes("gümüş") || str.includes("серебр")) return "#cbd5e1";
  if (str.includes("blue") || str.includes("mavi") || str.includes("göy") || str.includes("син") || str.includes("голубо")) return "#2563eb";
  if (str.includes("red") || str.includes("qırmız") || str.includes("красн")) return "#dc2626";
  if (str.includes("green") || str.includes("yaşıl") || str.includes("зелен")) return "#16a34a";
  if (str.includes("pink") || str.includes("çəhrayı") || str.includes("розов")) return "#ec4899";
  if (str.includes("purple") || str.includes("bənövşəyi") || str.includes("фиолет")) return "#9333ea";
  if (str.includes("yellow") || str.includes("sarı") || str.includes("желт")) return "#facc15";
  if (str.includes("orange") || str.includes("narıncı") || str.includes("оранж")) return "#ea580c";
  if (str.includes("brown") || str.includes("qəhvəyi") || str.includes("коричн")) return "#78350f";

  return "#94a3b8";
}

function formatVariantLabel(
  variant: { name: string; color: string | null; storage_gb: number | null },
  baseName: string
): string {
  if (variant.color) return variant.color;

  let label = variant.name;
  if (baseName && label.toLowerCase().startsWith(baseName.toLowerCase())) {
    label = label.slice(baseName.length).trim();
    label = label.replace(/^[:\-–\s]+/, "");
  }

  if (variant.storage_gb) {
    label = label.replace(new RegExp(`\\b${variant.storage_gb}\\s*GB\\b`, "gi"), "").trim();
  }

  return label || variant.name;
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const [{ productId }, t, format] = await Promise.all([
    params,
    getTranslations(),
    getFormatter(),
  ]);
  const data = await getProductPageData(productId);

  if (data.status === "not-found") notFound();

  if (data.status === "unavailable") {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto flex min-h-[60vh] max-w-[760px] items-center px-4 py-12 sm:px-6">
          <div className="w-full rounded-card border border-border bg-white p-6 text-center sm:p-10">
            <h1 className="text-2xl font-extrabold">{t("productPage.unavailableTitle")}</h1>
            <p className="mx-auto mt-3 max-w-prose text-[#71717a]">
              {t("productPage.unavailableBody")}
            </p>
            <Link
              href="/products"
              className="mt-6 inline-flex min-h-11 items-center rounded-button bg-accent px-5 text-sm font-bold text-white"
            >
              {t("productPage.backToCatalogue")}
            </Link>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  const { product } = data;
  const storeNames = new Map(data.stores.map((store) => [store.id, store.name]));
  const prices = [...product.current_prices].sort(
    (a, b) => a.price_azn - b.price_azn,
  );
  const lowestPrice = prices.find((price) => price.in_stock)?.price_azn ?? null;
  const historyPrices = data.history.map((point) => point.price_azn);
  const historyMin = historyPrices.length ? Math.min(...historyPrices) : null;
  const historyMax = historyPrices.length ? Math.max(...historyPrices) : null;
  const attributes = Object.entries(product.attributes ?? {}).filter(
    ([, value]) => value !== null && value !== undefined,
  );
  const attributeLabels: Record<string, string> = {
    storage_gb: t("productPage.attributes.storage"),
    color: t("productPage.attributes.color"),
    chip: t("productPage.attributes.chip"),
    size_mm: t("productPage.attributes.watchSize"),
    size_inch: t("productPage.attributes.screenSize"),
  };

  return (
    <>
      <SiteHeader />
      <main className="mx-auto min-h-[60vh] max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8">
        <nav
          className="mb-5 flex flex-wrap items-center gap-1 text-sm text-[#71717a]"
          aria-label={t("common.breadcrumb")}
        >
          <Link href="/" className="inline-flex min-h-11 items-center hover:text-foreground">
            {t("common.home")}
          </Link>
          <ChevronRight className="size-3.5" aria-hidden="true" />
          <Link
            href="/products"
            className="inline-flex min-h-11 items-center hover:text-foreground"
          >
            {t("catalogue.title")}
          </Link>
          <ChevronRight className="size-3.5" aria-hidden="true" />
          <span className="line-clamp-1 text-foreground">{product.name}</span>
        </nav>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.85fr)]">
          <div className="relative flex min-h-[320px] items-center justify-center overflow-hidden rounded-card border border-border bg-white p-5 sm:min-h-[460px] sm:p-8">
            <FavouriteButton label={t("product.favourite")} />
            <div
              className="h-full min-h-[260px] w-full bg-contain bg-center bg-no-repeat sm:min-h-[390px]"
              style={{
                backgroundImage: product.image_url
                  ? `url(${JSON.stringify(product.image_url)})`
                  : "repeating-linear-gradient(45deg, #f4f4f5 0, #f4f4f5 12px, #fafafa 12px, #fafafa 24px)",
              }}
            >
              {!product.image_url ? (
                <span className="flex h-full min-h-[260px] items-center justify-center font-mono text-sm text-[#a1a1aa] sm:min-h-[390px]">
                  qiymetleri.com
                </span>
              ) : null}
            </div>
          </div>

          <div className="rounded-card border border-border bg-white p-5 sm:p-7">
            <div className="flex flex-wrap gap-2 text-xs font-bold tracking-[0.05em] uppercase">
              {product.brand ? (
                <span className="rounded-badge bg-[#f4f4f5] px-2.5 py-1.5 text-[#52525b]">
                  {product.brand}
                </span>
              ) : null}
              {product.category ? (
                <Link
                  href={`/products?category=${encodeURIComponent(product.category)}`}
                  className="rounded-badge bg-accent-soft px-2.5 py-1.5 text-accent"
                >
                  {categoryTranslationKeys[product.category]
                    ? t(`categories.${categoryTranslationKeys[product.category]}`)
                    : product.category}
                </Link>
              ) : null}
            </div>

            <h1 className="mt-4 text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">
              {product.name}
            </h1>
            <p className="mt-2 text-sm text-[#71717a]">{product.canonical_id}</p>

            <div className="mt-6 rounded-card bg-[#f8fafc] p-4">
              <div className="flex items-center gap-2 text-xs font-extrabold tracking-[0.05em] text-[#16a34a] uppercase">
                <TrendingDown className="size-4" />
                {t("product.cheapest")}
              </div>
              <div className="mt-1 text-3xl font-extrabold tracking-[-0.04em]">
                {lowestPrice === null
                  ? "-"
                  : `${format.number(lowestPrice)} ${t("product.unit")}`}
              </div>
              <p className="mt-1 text-sm text-[#71717a]">
                {t("productPage.offerSummary", { count: prices.length })}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-button border border-border p-3">
                <Store className="size-4 text-accent" />
                <div className="mt-2 text-lg font-extrabold">{prices.length}</div>
                <div className="text-xs text-[#71717a]">{t("productPage.stores")}</div>
              </div>
              <div className="rounded-button border border-border p-3">
                <Clock3 className="size-4 text-accent" />
                <div className="mt-2 text-sm font-extrabold">
                  {format.dateTime(new Date(product.updated_at), {
                    day: "2-digit",
                    month: "short",
                  })}
                </div>
                <div className="text-xs text-[#71717a]">{t("productPage.updated")}</div>
              </div>
            </div>

            <div className="mt-5 flex items-start gap-3 rounded-button bg-accent-soft p-3 text-sm text-[#52525b]">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" />
              {t("productPage.priceNotice")}
            </div>
          </div>
        </section>

        <section className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
          <div className="rounded-card border border-border bg-white p-5 sm:p-7">
            <h2 className="text-xl font-extrabold">{t("productPage.offersTitle")}</h2>
            <div className="mt-4 space-y-3">
              {prices.length ? (
                prices.map((price, index) => (
                  <PriceRow
                    key={price.id}
                    price={price}
                    storeName={storeNames.get(price.store_id) ?? price.store_id}
                    cheapest={index === 0 && price.in_stock}
                    cheapestLabel={t("product.cheapest")}
                    inStockLabel={t("productPage.inStock")}
                    outOfStockLabel={t("productPage.outOfStock")}
                    goToStoreLabel={t("productPage.goToStore")}
                    unit={t("product.unit")}
                    formatNumber={(value) => format.number(value)}
                  />
                ))
              ) : (
                <p className="rounded-button bg-[#fafafa] p-4 text-sm text-[#71717a]">
                  {t("productPage.noOffers")}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {product.variants.length > 1 ? (
              <section className="space-y-4 rounded-card border border-border bg-white p-5">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h2 className="text-lg font-extrabold">{t("productPage.variants")}</h2>
                  <span className="text-xs font-semibold text-[#71717a]">
                    {product.variants.length} variant
                  </span>
                </div>

                {(() => {
                  // 1. Calculate price for every variant
                  const variantPrices = new Map<string, number | null>();
                  for (const v of product.variants) {
                    const inStock = v.current_prices?.filter((p) => p.in_stock);
                    const pool =
                      inStock && inStock.length > 0 ? inStock : v.current_prices || [];
                    const price =
                      pool.length > 0 ? Math.min(...pool.map((p) => p.price_azn)) : null;
                    variantPrices.set(v.id, price);
                  }

                  // 2. Identify storage/capacity groups
                  const storageGroupKeys: (number | string)[] = [];
                  const storageMap = new Map<number | string, typeof product.variants>();
                  const storageMinPrices = new Map<number | string, number>();

                  for (const v of product.variants) {
                    const key = v.storage_gb ?? "other";
                    if (!storageMap.has(key)) {
                      storageGroupKeys.push(key);
                      storageMap.set(key, []);
                    }
                    storageMap.get(key)!.push(v);

                    const price = variantPrices.get(v.id);
                    if (price !== null && price !== undefined) {
                      const currMin = storageMinPrices.get(key);
                      if (currMin === undefined || price < currMin) {
                        storageMinPrices.set(key, price);
                      }
                    }
                  }

                  const hasStorageOptions =
                    storageGroupKeys.length > 1 ||
                    (storageGroupKeys.length === 1 && storageGroupKeys[0] !== "other");

                  const currentVariant = product.variants.find((v) => v.id === product.id);
                  const currentStorageKey = currentVariant?.storage_gb ?? (product.attributes?.storage_gb as number | undefined) ?? "other";
                  const activeStorageGroup =
                    storageMap.get(currentStorageKey) ??
                    storageMap.get(storageGroupKeys[0]) ??
                    product.variants;
                  const currentStorageMinPrice = storageMinPrices.get(currentStorageKey);

                  let overallMinPrice: number | null = null;
                  for (const price of storageMinPrices.values()) {
                    if (overallMinPrice === null || price < overallMinPrice) {
                      overallMinPrice = price;
                    }
                  }

                  return (
                    <div className="space-y-5">
                      {/* SECTION 1: Yaddaş / Həcm Seçimi */}
                      {hasStorageOptions ? (
                        <div className="space-y-2">
                          <div className="text-xs font-extrabold uppercase tracking-[0.05em] text-[#71717a]">
                            Yaddaş / Həcm
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {storageGroupKeys.map((storageKey) => {
                              const isCurrentStorage = currentStorageKey === storageKey;
                              const minPrice = storageMinPrices.get(storageKey);
                              const isCheapestCap =
                                minPrice !== undefined &&
                                overallMinPrice !== null &&
                                minPrice === overallMinPrice;
                              const groupVars = storageMap.get(storageKey) || [];
                              const repVariant =
                                groupVars.find((v) => v.id === product.id) || groupVars[0];

                              return (
                                <Link
                                  key={String(storageKey)}
                                  href={`/products/${repVariant.id}`}
                                  className={`flex flex-col rounded-button border px-3 py-2 text-xs transition-all ${
                                    isCurrentStorage
                                      ? "border-accent bg-accent-soft text-accent font-extrabold ring-1 ring-accent/30"
                                      : "border-border bg-white hover:border-accent hover:bg-slate-50 text-[#09090b]"
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 font-bold text-sm">
                                    <span>
                                      {typeof storageKey === "number"
                                        ? `${storageKey} GB`
                                        : storageKey}
                                    </span>
                                    {isCheapestCap ? (
                                      <span className="rounded bg-[#dcfce7] px-1.5 py-0.5 text-[9px] font-extrabold text-[#15803d]">
                                        {t("product.cheapest")}
                                      </span>
                                    ) : null}
                                  </div>
                                  {minPrice !== undefined ? (
                                    <span className="mt-0.5 text-[11px] font-medium text-[#71717a]">
                                      {format.number(minPrice)} {t("product.unit")}-dən
                                    </span>
                                  ) : null}
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      {/* SECTION 2: Rənglər / Model / Versiya */}
                      {(() => {
                        const hasColors = activeStorageGroup.some((v) => Boolean(v.color));
                        const sectionTitle = hasColors ? "Rənglər" : "Model / Versiya";

                        return (
                          <div className="w-full max-w-full space-y-2 overflow-hidden">
                            <div className="text-xs font-extrabold uppercase tracking-[0.05em] text-[#71717a]">
                              {sectionTitle}
                            </div>
                            <div className="grid w-full max-w-full gap-2">
                              {activeStorageGroup.map((variant) => {
                                const isSelected = variant.id === product.id;
                                const price = variantPrices.get(variant.id) ?? null;
                                const isCheapestColor =
                                  price !== null &&
                                  currentStorageMinPrice !== undefined &&
                                  price === currentStorageMinPrice;
                                const displayLabel = formatVariantLabel(variant, product.name);

                                return (
                                  <Link
                                    key={variant.id}
                                    href={`/products/${variant.id}`}
                                    className={`flex w-full max-w-full items-center justify-between gap-3 overflow-hidden rounded-button border p-3 text-sm transition-all ${
                                      isSelected
                                        ? "border-accent bg-accent-soft font-extrabold text-accent ring-1 ring-accent/30"
                                        : "border-border bg-white text-[#09090b] hover:border-accent hover:bg-slate-50"
                                    }`}
                                  >
                                    <div className="flex min-w-0 items-center gap-2.5 overflow-hidden">
                                      {variant.color ? (
                                        <span
                                          className="inline-block size-4 shrink-0 rounded-full border border-black/15 shadow-sm"
                                          style={{ backgroundColor: getColorHex(variant.color) }}
                                          aria-hidden="true"
                                        />
                                      ) : null}
                                      <span className="min-w-0 truncate font-bold">
                                        {displayLabel}
                                      </span>
                                    </div>

                                    <div className="flex shrink-0 items-center gap-2">
                                      {price !== null ? (
                                        <span className="font-extrabold text-[#09090b]">
                                          {format.number(price)} {t("product.unit")}
                                        </span>
                                      ) : (
                                        <span className="text-xs text-[#a1a1aa]">-</span>
                                      )}
                                      {isCheapestColor ? (
                                        <span className="rounded bg-[#dcfce7] px-1.5 py-0.5 text-[10px] font-extrabold text-[#15803d]">
                                          {t("product.cheapest")}
                                        </span>
                                      ) : null}
                                    </div>
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}
              </section>
            ) : null}

            {attributes.length ? (
              <section className="rounded-card border border-border bg-white p-5">
                <h2 className="text-lg font-extrabold">{t("productPage.features")}</h2>
                <dl className="mt-3 divide-y divide-border">
                  {attributes.map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-4 py-3 text-sm">
                      <dt className="text-[#71717a]">
                        {attributeLabels[key] ?? key.replaceAll("_", " ")}
                      </dt>
                      <dd className="text-right font-semibold">
                        {String(value)}
                        {key === "storage_gb" ? " GB" : ""}
                        {key === "size_mm" ? " mm" : ""}
                        {key === "size_inch" ? "″" : ""}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}
          </div>
        </section>

        <section className="mt-7 rounded-card border border-border bg-white p-5 sm:p-7">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="size-5 text-accent" />
                <h2 className="text-xl font-extrabold">{t("productPage.historyTitle")}</h2>
              </div>
              <p className="mt-1 text-sm text-[#71717a]">{t("productPage.historyBody")}</p>
            </div>
            {historyMin !== null && historyMax !== null ? (
              <div className="text-sm font-semibold text-[#52525b]">
                {format.number(historyMin)}–{format.number(historyMax)} {t("product.unit")}
              </div>
            ) : null}
          </div>

          {data.history.length ? (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-xs tracking-[0.05em] text-[#71717a] uppercase">
                  <tr>
                    <th className="pb-3 font-bold">{t("productPage.date")}</th>
                    <th className="pb-3 font-bold">{t("productPage.store")}</th>
                    <th className="pb-3 text-right font-bold">{t("productPage.price")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.history
                    .slice(-8)
                    .reverse()
                    .map((point) => (
                      <tr key={`${point.product_id}-${point.store_id}-${point.time}`}>
                        <td className="py-3">
                          {format.dateTime(new Date(point.time), {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-3 font-semibold">
                          {storeNames.get(point.store_id) ?? point.store_id}
                        </td>
                        <td className="py-3 text-right font-extrabold">
                          {format.number(point.price_azn)} {t("product.unit")}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-5 rounded-button bg-[#fafafa] p-4 text-sm text-[#71717a]">
              {t("productPage.noHistory")}
            </p>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function PriceRow({
  price,
  storeName,
  cheapest,
  cheapestLabel,
  inStockLabel,
  outOfStockLabel,
  goToStoreLabel,
  unit,
  formatNumber,
}: {
  price: CurrentPrice;
  storeName: string;
  cheapest: boolean;
  cheapestLabel: string;
  inStockLabel: string;
  outOfStockLabel: string;
  goToStoreLabel: string;
  unit: string;
  formatNumber: (value: number) => string;
}) {
  const retailerUrl = safeRetailerUrl(price.url);

  return (
    <div className="flex flex-col gap-4 rounded-button border border-border p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-extrabold">{storeName}</h3>
          {cheapest ? (
            <span className="rounded-badge bg-[#dcfce7] px-2 py-1 text-[11px] font-extrabold text-[#15803d] uppercase">
              {cheapestLabel}
            </span>
          ) : null}
        </div>
        <p className={`mt-1 text-xs font-semibold ${price.in_stock ? "text-[#16a34a]" : "text-[#a1a1aa]"}`}>
          {price.in_stock ? inStockLabel : outOfStockLabel}
        </p>
      </div>
      <div className="text-2xl font-extrabold">
        {formatNumber(price.price_azn)} {unit}
      </div>
      {retailerUrl ? (
        <a
          href={retailerUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-button bg-accent px-4 text-sm font-bold text-white"
        >
          {goToStoreLabel}
          <ExternalLink className="size-4" />
        </a>
      ) : null}
    </div>
  );
}

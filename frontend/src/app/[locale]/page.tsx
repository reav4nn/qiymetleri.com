import { SearchBar } from "@/components/SearchBar";
import { TrendingSearches } from "@/components/TrendingSearches";
import { StoreLogos } from "@/components/StoreLogos";
import { CategoryCard } from "@/components/CategoryCard";
import { AdBanner } from "@/components/AdBanner";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { buildAlternates, ogLocale, absoluteUrl, SITE_NAME } from "@/lib/seo";
import type { Metadata } from "next";

const CATEGORY_SLUGS = ["smartphones", "laptops", "headphones", "smartwatches"];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    title: t("homeTitle"),
    description: t("homeDescription"),
    alternates: buildAlternates(`/${locale}`),
    openGraph: {
      siteName: SITE_NAME,
      type: "website",
      locale: ogLocale(locale),
      title: t("homeTitle"),
      description: t("homeDescription"),
      url: absoluteUrl(`/${locale}`),
    },
    twitter: {
      card: "summary",
      title: t("homeTitle"),
      description: t("homeDescription"),
    },
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");

  return (
    <div>
      {/* Hero */}
      <section className="hero-section relative overflow-hidden">
        <div className="hero-bg-pattern" aria-hidden="true" />
        <div className="hero-gradient" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-4 py-10 text-center sm:px-6 sm:py-16 md:py-20 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-accent)]/20 bg-[var(--color-accent-subtle)] px-3 py-1 text-xs font-medium text-[var(--color-accent)] sm:px-4 sm:py-1.5 sm:text-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-accent)] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-accent)]" />
            </span>
            {t("livePrices")}
          </div>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-[var(--color-text-primary)] sm:mt-6 sm:text-5xl md:text-6xl">
            {t("heroTitlePrefix")}{" "}
            <span className="hero-gradient-text">{t("heroTitleAccent")}</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-[var(--color-text-secondary)] sm:mt-5 sm:text-lg">
            {t("heroSubtitle")}
          </p>
          <div className="mx-auto mt-7 max-w-xl sm:mt-9">
            <SearchBar />
          </div>
          <TrendingSearches />
        </div>
      </section>

      {/* Trusted Stores */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <StoreLogos />
      </div>

      {/* Ad Banner */}
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 sm:pt-10 lg:px-8">
        <AdBanner
          slot={process.env.NEXT_PUBLIC_AD_SLOT_HOME || ""}
          format="horizontal"
        />
      </div>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 sm:pb-16 lg:px-8">
        <div className="mt-10 sm:mt-16">
          <h2 className="text-center text-xl font-bold text-[var(--color-text-primary)] sm:text-2xl">
            {t("categories")}
          </h2>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:mt-8 sm:grid-cols-4 sm:gap-5">
            {CATEGORY_SLUGS.map((slug) => (
              <CategoryCard key={slug} slug={slug} locale={locale} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

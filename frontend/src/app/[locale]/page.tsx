import { ProductAutocomplete } from "@/components/ProductAutocomplete";
import { TrendingSearches } from "@/components/TrendingSearches";
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
      images: [
        {
          url: absoluteUrl("/qiymetleriNonTransparentDark.png"),
          width: 1080,
          height: 1080,
          alt: SITE_NAME,
        },
      ],
    },
    twitter: {
      card: "summary",
      title: t("homeTitle"),
      description: t("homeDescription"),
      images: [absoluteUrl("/qiymetleriNonTransparentDark.png")],
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
    <div className="px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
      <div className="mx-auto max-w-xl text-center">
        <h1 className="text-3xl font-semibold text-[var(--color-text-primary)] sm:text-4xl">
          {t("heroTitlePrefix")} {t("heroTitleAccent")}
        </h1>
        <p className="mt-3 text-sm text-[var(--color-text-secondary)] sm:mt-4 sm:text-base">
          {t("heroSubtitle")}
        </p>
        <div className="mt-7 sm:mt-9">
          <ProductAutocomplete locale={locale} />
        </div>
        <TrendingSearches />
      </div>

      <div className="mx-auto mt-10 max-w-xl sm:mt-14">
        <AdBanner
          slot={process.env.NEXT_PUBLIC_AD_SLOT_HOME || ""}
          format="horizontal"
        />
      </div>

      <section className="mx-auto mt-10 max-w-3xl sm:mt-14">
        <h2 className="text-center text-lg font-semibold text-[var(--color-text-primary)] sm:text-xl">
          {t("categories")}
        </h2>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:mt-6 sm:grid-cols-4 sm:gap-4">
          {CATEGORY_SLUGS.map((slug) => (
            <CategoryCard key={slug} slug={slug} locale={locale} />
          ))}
        </div>
      </section>
    </div>
  );
}

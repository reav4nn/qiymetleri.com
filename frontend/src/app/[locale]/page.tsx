import { SearchBar } from "@/components/SearchBar";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { buildAlternates, ogLocale, absoluteUrl, SITE_NAME } from "@/lib/seo";
import type { Metadata } from "next";

const CATEGORY_ICONS: Record<string, string> = {
  smartphones: "📱",
  laptops: "💻",
  headphones: "🎧",
  smartwatches: "⌚",
};

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
  const tc = await getTranslations("categories");

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-12 lg:px-8">
      {/* Hero */}
      <section className="py-6 text-center sm:py-12">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-4xl md:text-5xl">
          {t("heroTitle")}
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-[var(--color-text-secondary)] sm:mt-4 sm:text-lg">
          {t("heroSubtitle")}
        </p>
        <div className="mx-auto mt-6 max-w-xl sm:mt-8">
          <SearchBar />
        </div>
      </section>

      {/* Categories */}
      <section className="mt-8 sm:mt-16">
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)] sm:text-2xl">
          {t("categories")}
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-6 sm:grid-cols-4 sm:gap-4">
          {CATEGORY_SLUGS.map((slug) => (
            <a
              key={slug}
              href={`/${locale}/search?category=${slug}`}
              className="flex flex-col items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 transition hover:border-[var(--color-accent)] hover:shadow-lg hover:shadow-[var(--color-accent-subtle)] active:scale-[0.97] sm:p-6"
            >
              <span className="text-3xl sm:text-4xl">{CATEGORY_ICONS[slug]}</span>
              <span className="mt-2 text-xs font-medium text-[var(--color-text-secondary)] sm:mt-3 sm:text-sm">
                {tc(slug)}
              </span>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

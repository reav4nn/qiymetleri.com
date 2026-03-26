import { SearchBar } from "@/components/SearchBar";
import { getTranslations, setRequestLocale } from "next-intl/server";

const CATEGORY_ICONS: Record<string, string> = {
  smartphones: "📱",
  laptops: "💻",
  headphones: "🎧",
  smartwatches: "⌚",
};

const CATEGORY_SLUGS = ["smartphones", "laptops", "headphones", "smartwatches"];

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
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Hero */}
      <section className="py-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-5xl">
          {t("heroTitle")}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--color-text-secondary)]">
          {t("heroSubtitle")}
        </p>
        <div className="mx-auto mt-8 max-w-xl">
          <SearchBar />
        </div>
      </section>

      {/* Categories */}
      <section className="mt-16">
        <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">
          {t("categories")}
        </h2>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {CATEGORY_SLUGS.map((slug) => (
            <a
              key={slug}
              href={`/${locale}/search?category=${slug}`}
              className="flex flex-col items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6 transition hover:border-[var(--color-accent)] hover:shadow-lg hover:shadow-[var(--color-accent-subtle)]"
            >
              <span className="text-4xl">{CATEGORY_ICONS[slug]}</span>
              <span className="mt-3 text-sm font-medium text-[var(--color-text-secondary)]">
                {tc(slug)}
              </span>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

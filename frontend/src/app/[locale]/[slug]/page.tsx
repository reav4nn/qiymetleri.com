import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Link } from "@/i18n/navigation";
import {
  contentPages,
  contentSlugs,
  isContentSlug,
  isSupportedLocale,
} from "@/lib/static-content";

export function generateStaticParams() {
  return contentSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isSupportedLocale(locale) || !isContentSlug(slug)) return {};
  const page = contentPages[locale][slug];
  return { title: `${page.title} | qiymetleri.com`, description: page.intro };
}

export default async function ContentPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const [{ locale, slug }, t] = await Promise.all([params, getTranslations()]);
  if (!isSupportedLocale(locale) || !isContentSlug(slug)) notFound();

  const page = contentPages[locale][slug];

  return (
    <>
      <SiteHeader />
      <main className="mx-auto min-h-[60vh] max-w-[1040px] px-4 py-6 sm:px-6 sm:py-10">
        <nav className="mb-5 text-sm text-[#71717a]" aria-label={t("common.breadcrumb")}>
          <Link href="/" className="inline-flex min-h-11 items-center hover:text-foreground">
            {t("common.home")}
          </Link>
          <span className="mx-2" aria-hidden="true">/</span>
          <span className="text-foreground">{page.title}</span>
        </nav>

        <header className="overflow-hidden rounded-card border border-border bg-white p-6 sm:p-10 lg:p-12">
          <p className="text-xs font-extrabold tracking-[0.1em] text-accent uppercase">
            {page.eyebrow}
          </p>
          <h1 className="mt-2 max-w-[760px] text-3xl font-extrabold tracking-[-0.04em] text-balance sm:text-4xl lg:text-5xl">
            {page.title}
          </h1>
          <p className="mt-5 max-w-prose text-base leading-relaxed text-[#52525b] sm:text-lg">
            {page.intro}
          </p>
        </header>

        <div className="mt-6 divide-y divide-border rounded-card border border-border bg-white">
          {page.sections.map((section) => (
            <section
              key={section.title}
              className="grid gap-2 px-5 py-5 sm:px-8 sm:py-7 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] md:gap-8"
            >
              <h2 className="text-base font-extrabold sm:text-lg">{section.title}</h2>
              <p className="max-w-prose text-sm leading-relaxed text-[#71717a] whitespace-pre-line sm:text-base">
                {section.body}
              </p>
            </section>
          ))}
        </div>

        {page.cta ? (
          <div className="mt-6 rounded-card bg-foreground p-6 text-white sm:flex sm:items-center sm:justify-between sm:p-8">
            <div>
              <h2 className="text-xl font-extrabold">{t("content.ctaTitle")}</h2>
              <p className="mt-1 text-sm text-white/65">{t("content.ctaBody")}</p>
            </div>
            {page.cta.href.startsWith("/") ? (
              <Link
                href={page.cta.href}
                className="mt-5 inline-flex min-h-12 items-center justify-center rounded-button bg-accent px-5 text-sm font-bold sm:mt-0"
              >
                {page.cta.label}
              </Link>
            ) : (
              <a
                href={page.cta.href}
                className="mt-5 inline-flex min-h-12 items-center justify-center rounded-button bg-accent px-5 text-sm font-bold sm:mt-0"
              >
                {page.cta.label}
              </a>
            )}
          </div>
        ) : null}
      </main>
      <SiteFooter />
    </>
  );
}

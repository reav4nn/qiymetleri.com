import type { Metadata } from "next";
import { NextIntlClientProvider, useMessages } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    title: {
      default: t("title"),
      template: "%s | qiymetleri.com",
    },
    description: t("description"),
    alternates: {
      languages: {
        az: "/az",
        ru: "/ru",
      },
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "az" | "ru")) {
    notFound();
  }

  setRequestLocale(locale);
  const t = await getTranslations("nav");
  const tFooter = await getTranslations("footer");
  const messages = (await import(`@/messages/${locale}.json`)).default;

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}else{document.documentElement.setAttribute('data-theme','dark')}}catch(e){document.documentElement.setAttribute('data-theme','dark')}})();`
        }} />
      </head>
      <body className="font-sans antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <header className="border-b border-[var(--color-border)]">
            <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
              <a href={`/${locale}`} className="text-xl font-bold text-[var(--color-accent)]">
                qiymetleri.com
              </a>
              <div className="flex items-center gap-4">
                <div className="hidden gap-6 md:flex">
                  <a
                    href={`/${locale}`}
                    className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  >
                    {t("home")}
                  </a>
                  <a
                    href={`/${locale}/search?category=smartphones`}
                    className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  >
                    {t("smartphones")}
                  </a>
                  <a
                    href={`/${locale}/search?category=laptops`}
                    className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  >
                    {t("laptops")}
                  </a>
                  <a
                    href={`/${locale}/search?category=headphones`}
                    className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  >
                    {t("headphones")}
                  </a>
                </div>
                <ThemeToggle />
                <LanguageSwitcher />
              </div>
            </nav>
          </header>
          <main>{children}</main>
          <footer className="mt-16 border-t border-[var(--color-border)] bg-[var(--color-bg-surface)] py-8">
            <div className="mx-auto max-w-7xl px-4 text-center text-sm text-[var(--color-text-muted)]">
              © {new Date().getFullYear()} {tFooter("tagline")}
            </div>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

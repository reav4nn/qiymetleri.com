import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider, useMessages } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

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
    <html lang={locale}>
      <body className={`${inter.className} bg-white text-gray-900 antialiased`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <header className="border-b border-gray-200">
            <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
              <a href={`/${locale}`} className="text-xl font-bold text-blue-600">
                qiymetleri.com
              </a>
              <div className="flex items-center gap-4">
                <div className="hidden gap-6 md:flex">
                  <a
                    href={`/${locale}`}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    {t("home")}
                  </a>
                  <a
                    href={`/${locale}/search?category=smartphones`}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    {t("smartphones")}
                  </a>
                  <a
                    href={`/${locale}/search?category=laptops`}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    {t("laptops")}
                  </a>
                  <a
                    href={`/${locale}/search?category=headphones`}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    {t("headphones")}
                  </a>
                </div>
                <LanguageSwitcher />
              </div>
            </nav>
          </header>
          <main>{children}</main>
          <footer className="mt-16 border-t border-gray-200 bg-gray-50 py-8">
            <div className="mx-auto max-w-7xl px-4 text-center text-sm text-gray-500">
              © {new Date().getFullYear()} {tFooter("tagline")}
            </div>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import localFont from "next/font/local";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import "../globals.css";

const manrope = localFont({
  src: "../../../public/fonts/manrope/Manrope[wght].ttf",
  weight: "200 800",
  style: "normal",
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "qiymetleri.com",
  description: "Elektronika məhsulları üçün real vaxtda qiymət müqayisəsi",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return (
    <html lang={locale} className={manrope.variable}>
      <body className="font-sans antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}

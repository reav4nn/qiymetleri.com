import type { Metadata } from "next";
import Image from "next/image";
import { NextIntlClientProvider, useMessages } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileNav } from "@/components/MobileNav";
import { SITE_NAME, absoluteUrl, buildAlternates, ogLocale } from "@/lib/seo";
import { organizationSchema, webSiteSchema } from "@/lib/schema";
import Script from "next/script";
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
      template: `%s | ${SITE_NAME}`,
    },
    description: t("description"),
    metadataBase: new URL(absoluteUrl("/")),
    alternates: buildAlternates(`/${locale}`),
    openGraph: {
      siteName: SITE_NAME,
      type: "website",
      locale: ogLocale(locale),
      title: t("title"),
      description: t("description"),
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
      title: t("title"),
      description: t("description"),
      images: [absoluteUrl("/qiymetleriNonTransparentDark.png")],
    },
    robots: { index: true, follow: true },
    icons: {
      icon: [
        { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/favicon.ico", sizes: "16x16" },
      ],
      apple: "/apple-touch-icon.png",
    },
    manifest: "/site.webmanifest",
    other: {
      "theme-color": "#4f46e5",
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

  const navLinks = [
    { href: `/${locale}`, label: t("home") },
    { href: `/${locale}/search?category=smartphones`, label: t("smartphones") },
    { href: `/${locale}/search?category=laptops`, label: t("laptops") },
    { href: `/${locale}/search?category=headphones`, label: t("headphones") },
  ];

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <script dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}else{document.documentElement.setAttribute('data-theme','dark')}}catch(e){document.documentElement.setAttribute('data-theme','dark')}})();`
        }} />
        {process.env.NEXT_PUBLIC_ADSENSE_ID && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_ID}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
      </head>
      <body className="font-sans antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema()),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(webSiteSchema()),
          }}
        />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-bg-page)]/95 backdrop-blur-md">
            <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
              <a href={`/${locale}`} className="flex items-center gap-2">
                <Image
                  src="/qiymetleriTransparentDark.png"
                  alt=""
                  width={32}
                  height={32}
                  className="logo-for-light h-8 w-8"
                  priority
                />
                <Image
                  src="/qiymetleriTransparentWhite.png"
                  alt=""
                  width={32}
                  height={32}
                  className="logo-for-dark h-8 w-8"
                  priority
                />
                <span className="text-lg font-bold text-[var(--color-accent)] sm:text-xl">
                  qiymetleri.com
                </span>
              </a>
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="hidden gap-6 md:flex">
                  {navLinks.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
                <ThemeToggle />
                <LanguageSwitcher />
                <MobileNav locale={locale} links={navLinks} />
              </div>
            </nav>
          </header>
          <main>{children}</main>
          <footer className="mt-8 border-t border-[var(--color-border)] bg-[var(--color-bg-surface)] py-6 sm:mt-16 sm:py-8">
            <div className="mx-auto max-w-7xl px-4 text-center text-xs text-[var(--color-text-muted)] sm:text-sm">
              © {new Date().getFullYear()} {tFooter("tagline")}
            </div>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

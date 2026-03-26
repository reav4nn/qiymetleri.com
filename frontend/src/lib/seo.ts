/**
 * SEO helper constants and utilities.
 */

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://qiymetleri.com";

export const SITE_NAME = "qiymetleri.com";

export const LOCALES = ["az", "ru"] as const;
export type SiteLocale = (typeof LOCALES)[number];

const OG_LOCALE_MAP: Record<string, string> = {
  az: "az_AZ",
  ru: "ru_RU",
};

export function ogLocale(locale: string): string {
  return OG_LOCALE_MAP[locale] ?? "az_AZ";
}

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Build hreflang alternates with absolute URLs + x-default */
export function buildAlternates(path: string) {
  return {
    canonical: absoluteUrl(path),
    languages: {
      az: absoluteUrl(`/az${path.replace(/^\/(az|ru)/, "")}`),
      ru: absoluteUrl(`/ru${path.replace(/^\/(az|ru)/, "")}`),
      "x-default": absoluteUrl(`/az${path.replace(/^\/(az|ru)/, "")}`),
    },
  };
}

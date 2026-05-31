"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const TRENDING_KEYS = [
  { key: "iphone16pro", query: "iPhone 16 Pro" },
  { key: "galaxyS25", query: "Galaxy S25 Ultra" },
  { key: "macbookAir", query: "MacBook Air M4" },
  { key: "airpodsPro", query: "AirPods Pro 2" },
  { key: "pixelWatch", query: "Pixel Watch 3" },
];

export function TrendingSearches() {
  const pathname = usePathname();
  const locale = pathname.split("/")[1] || "az";
  const t = useTranslations("home");

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 sm:mt-5">
      <span className="text-xs text-[var(--color-text-muted)]">
        {t("trending")}
      </span>
      {TRENDING_KEYS.map(({ key, query }) => (
        <a
          key={key}
          href={`/${locale}/search?q=${encodeURIComponent(query)}`}
          className="text-xs text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-primary)]"
        >
          {query}
        </a>
      ))}
    </div>
  );
}

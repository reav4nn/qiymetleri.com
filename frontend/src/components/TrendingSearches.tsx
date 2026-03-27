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
    <div className="mt-4 flex flex-col items-center gap-2 sm:mt-5">
      <span className="text-xs font-medium text-[var(--color-text-muted)] sm:text-sm">
        {t("trending")}
      </span>
      <div className="flex flex-wrap justify-center gap-2">
        {TRENDING_KEYS.map(({ key, query }) => (
          <a
            key={key}
            href={`/${locale}/search?q=${encodeURIComponent(query)}`}
            className="group inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-all duration-200 hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] hover:text-[var(--color-accent)] active:scale-95 sm:px-4 sm:py-2 sm:text-sm"
          >
            <svg
              className="h-3 w-3 text-[var(--color-text-muted)] transition-colors group-hover:text-[var(--color-accent)] sm:h-3.5 sm:w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"
              />
            </svg>
            {query}
          </a>
        ))}
      </div>
    </div>
  );
}

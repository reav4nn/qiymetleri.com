"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

export function SearchBar() {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("search");

  const locale = pathname.split("/")[1] || "az";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/${locale}/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full gap-2">
      <div className="relative flex-1">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("placeholder")}
          className="h-11 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-page)] py-2 pl-9 pr-3 text-sm text-[var(--color-text-primary)] shadow-sm placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-border-hover)] focus:outline-none"
        />
      </div>
      <button
        type="submit"
        className="shrink-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-page)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] transition hover:bg-[var(--color-bg-surface-hover)] active:scale-95"
      >
        {t("button")}
      </button>
    </form>
  );
}

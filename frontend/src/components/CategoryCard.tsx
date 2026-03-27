import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

interface CategoryCardProps {
  slug: string;
  locale: string;
}

const CATEGORY_SVG: Record<string, ReactNode> = {
  smartphones: (
    <svg className="h-8 w-8 sm:h-10 sm:w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth={2} />
    </svg>
  ),
  laptops: (
    <svg className="h-8 w-8 sm:h-10 sm:w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16" />
    </svg>
  ),
  headphones: (
    <svg className="h-8 w-8 sm:h-10 sm:w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </svg>
  ),
  smartwatches: (
    <svg className="h-8 w-8 sm:h-10 sm:w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="6" width="12" height="12" rx="3" />
      <path d="M9 2h6v4H9zM9 18h6v4H9z" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <path d="M12 9v2" />
    </svg>
  ),
};

export async function CategoryCard({ slug, locale }: CategoryCardProps) {
  const tc = await getTranslations("categories");

  return (
    <a
      href={`/${locale}/search?category=${slug}`}
      className="category-card group flex flex-col items-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--color-accent)] hover:shadow-xl hover:shadow-[var(--color-accent-subtle)] active:scale-[0.97] sm:p-7"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--color-accent-subtle)] text-[var(--color-accent)] transition-all duration-300 group-hover:scale-110 group-hover:bg-[var(--color-accent)] group-hover:text-white sm:h-16 sm:w-16 sm:rounded-2xl">
        {CATEGORY_SVG[slug]}
      </div>
      <span className="mt-3 text-xs font-semibold text-[var(--color-text-secondary)] transition-colors duration-300 group-hover:text-[var(--color-text-primary)] sm:mt-4 sm:text-sm">
        {tc(slug)}
      </span>
    </a>
  );
}

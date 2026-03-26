"use client";

import { usePathname } from "next/navigation";

const LOCALES = [
  { code: "az", label: "AZ" },
  { code: "ru", label: "RU" },
];

export function LanguageSwitcher() {
  const pathname = usePathname();

  const currentLocale = pathname.split("/")[1] || "az";

  const switchLocale = (newLocale: string) => {
    const segments = pathname.split("/");
    if (LOCALES.some((l) => l.code === segments[1])) {
      segments[1] = newLocale;
    } else {
      segments.splice(1, 0, newLocale);
    }
    return segments.join("/") || "/";
  };

  return (
    <div className="flex items-center gap-1 rounded-lg border border-[var(--color-border)] p-0.5">
      {LOCALES.map((locale) => (
        <a
          key={locale.code}
          href={switchLocale(locale.code)}
          className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
            currentLocale === locale.code
              ? "bg-[var(--color-accent)] text-white"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          {locale.label}
        </a>
      ))}
    </div>
  );
}

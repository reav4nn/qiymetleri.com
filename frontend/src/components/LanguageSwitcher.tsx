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
    <div className="flex items-center gap-0">
      {LOCALES.map((locale, i) => (
        <a
          key={locale.code}
          href={switchLocale(locale.code)}
          className={`px-2 py-1 text-xs font-medium transition ${
            currentLocale === locale.code
              ? "text-[var(--color-text-primary)]"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
          } ${i === 0 ? "border-r border-[var(--color-border)]" : ""}`}
        >
          {locale.label}
        </a>
      ))}
    </div>
  );
}

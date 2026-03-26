"use client";

import { usePathname } from "next/navigation";
import { useRef, useEffect, useState } from "react";

const LOCALES = [
  { code: "az", label: "AZ" },
  { code: "ru", label: "RU" },
];

export function LanguageSwitcher() {
  const pathname = usePathname();
  const currentLocale = pathname.split("/")[1] || "az";
  const containerRef = useRef<HTMLDivElement>(null);
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const activeBtn = container.querySelector(`[data-locale="${currentLocale}"]`) as HTMLElement;
    if (activeBtn) {
      setPillStyle({
        left: activeBtn.offsetLeft,
        width: activeBtn.offsetWidth,
      });
    }
  }, [currentLocale]);

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
    <div ref={containerRef} className="relative flex items-center gap-0.5 rounded-lg border border-[var(--color-border)] p-0.5">
      {/* Sliding pill background */}
      <div
        className="absolute rounded-md bg-[var(--color-accent)] transition-all duration-300 ease-in-out"
        style={{
          left: `${pillStyle.left}px`,
          width: `${pillStyle.width}px`,
          top: '2px',
          bottom: '2px',
        }}
      />
      {LOCALES.map((locale) => (
        <a
          key={locale.code}
          href={switchLocale(locale.code)}
          data-locale={locale.code}
          className={`relative z-10 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors duration-300 ${
            currentLocale === locale.code
              ? "text-white"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          {locale.label}
        </a>
      ))}
    </div>
  );
}

"use client";

import { useLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function LanguageToggle() {
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <div className="flex items-center rounded-[9px] bg-[#f4f4f5] p-[2px] text-xs font-semibold sm:text-[13px]">
      {routing.locales.map((loc) => {
        const isActive = loc === locale;
        return (
          <Link
            key={loc}
            href={pathname}
            locale={loc}
            className={cn(
              "inline-flex min-h-11 min-w-11 items-center justify-center rounded-[7px] px-2 uppercase transition-colors sm:px-3",
              isActive
                ? "bg-white text-foreground shadow-[0_1px_2px_rgba(0,0,0,.06)]"
                : "text-[#71717a]",
            )}
          >
            {loc}
          </Link>
        );
      })}
    </div>
  );
}

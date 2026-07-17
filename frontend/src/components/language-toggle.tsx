"use client";

import { useLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function LanguageToggle() {
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <div className="flex items-center rounded-[9px] bg-[#f4f4f5] p-[3px] text-[13px] font-semibold">
      {routing.locales.map((loc) => {
        const isActive = loc === locale;
        return (
          <Link
            key={loc}
            href={pathname}
            locale={loc}
            className={cn(
              "rounded-[7px] px-3 py-1.5 uppercase transition-colors",
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

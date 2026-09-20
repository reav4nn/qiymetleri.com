import type { Locale } from "@/i18n/locale-context";

export const navigationCopy = {
  az: {
    home: "Ana səhifə",
    catalogue: "Kataloq",
    more: "Daha çox",
    product: "Məhsul",
    information: "Məlumat",
    language: "Dil",
  },
  ru: {
    home: "Главная",
    catalogue: "Каталог",
    more: "Ещё",
    product: "Товар",
    information: "Информация",
    language: "Язык",
  },
} as const satisfies Record<Locale, Record<string, string>>;

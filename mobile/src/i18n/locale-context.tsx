import type { PropsWithChildren } from "react";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AsyncStorage } from "expo-sqlite/kv-store";

import az from "@/i18n/messages/az.json";
import ru from "@/i18n/messages/ru.json";

export const supportedLocales = ["az", "ru"] as const;
export type Locale = (typeof supportedLocales)[number];
type MessageValues = Record<string, string | number>;

const messages = { az, ru } as const;
const storageKey = "qiymetleri.locale";

const azMonths = {
  long: [
    "yanvar",
    "fevral",
    "mart",
    "aprel",
    "may",
    "iyun",
    "iyul",
    "avqust",
    "sentyabr",
    "oktyabr",
    "noyabr",
    "dekabr",
  ],
  short: ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avq", "sen", "okt", "noy", "dek"],
} as const;

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, values?: MessageValues) => string;
  formatNumber: (value: number) => string;
  formatDate: (value: Date, options?: Intl.DateTimeFormatOptions) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function isLocale(value: string | null): value is Locale {
  return supportedLocales.some((locale) => locale === value);
}

function messageAt(locale: Locale, key: string): string {
  let value: unknown = messages[locale];
  for (const segment of key.split(".")) {
    if (!value || typeof value !== "object") return key;
    value = (value as Record<string, unknown>)[segment];
  }
  return typeof value === "string" ? value : key;
}

function formatMessage(
  template: string,
  values: MessageValues,
  numberFormat: Intl.NumberFormat,
): string {
  return template.replace(/\{(\w+)(?:,\s*(number))?\}/g, (match, key: string, kind?: string) => {
    const value = values[key];
    if (value === undefined) return match;
    return kind === "number" && typeof value === "number"
      ? numberFormat.format(value)
      : String(value);
  });
}

export function formatDateForLocale(
  locale: Locale,
  date: Date,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "numeric", year: "numeric" },
): string {
  if (locale === "ru" || Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "az-AZ", options).format(date);
  }

  const day = options.day
    ? options.day === "2-digit"
      ? String(date.getDate()).padStart(2, "0")
      : String(date.getDate())
    : null;
  const month = options.month
    ? options.month === "long" || options.month === "short"
      ? azMonths[options.month][date.getMonth()]
      : options.month === "2-digit"
        ? String(date.getMonth() + 1).padStart(2, "0")
        : String(date.getMonth() + 1)
    : null;
  const year = options.year
    ? options.year === "2-digit"
      ? String(date.getFullYear()).slice(-2)
      : String(date.getFullYear())
    : null;

  const separator = options.month === "numeric" || options.month === "2-digit" ? "." : " ";
  return [day, month, year].filter(Boolean).join(separator);
}

export function LocaleProvider({
  children,
  initialLocale = "az",
}: PropsWithChildren<{ initialLocale?: Locale }>) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const localeChangedByUser = useRef(false);
  const intlLocale = locale === "az" ? "az-AZ" : "ru-RU";
  const numberFormat = useMemo(() => new Intl.NumberFormat(intlLocale), [intlLocale]);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(storageKey)
      .then((stored) => {
        if (active && !localeChangedByUser.current && isLocale(stored)) {
          setLocaleState(stored);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const setLocale = useCallback((nextLocale: Locale) => {
    localeChangedByUser.current = true;
    setLocaleState(nextLocale);
    void AsyncStorage.setItem(storageKey, nextLocale).catch(() => undefined);
  }, []);

  const t = useCallback(
    (key: string, values: MessageValues = {}) =>
      formatMessage(messageAt(locale, key), values, numberFormat),
    [locale, numberFormat],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      formatNumber: (number) => numberFormat.format(number),
      formatDate: (date, options) => formatDateForLocale(locale, date, options),
    }),
    [locale, numberFormat, setLocale, t],
  );

  return <LocaleContext value={value}>{children}</LocaleContext>;
}

export function useLocale() {
  const context = use(LocaleContext);
  if (!context) throw new Error("useLocale must be used inside LocaleProvider");
  return context;
}

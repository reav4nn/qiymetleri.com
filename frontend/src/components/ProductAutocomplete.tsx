"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Autocomplete,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
  AutocompleteStatus,
} from "@/components/ui/autocomplete";
import type { Product } from "@/lib/api";

const API_BASE_URL =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
    : "http://localhost:8000";

const MIN_QUERY_LENGTH = 2;
const PER_PAGE = 8;

interface ProductAutocompleteProps {
  locale: string;
}

async function fetchSearchResults(q: string): Promise<Product[]> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/search?q=${encodeURIComponent(q)}&page=1&per_page=${PER_PAGE}`,
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.items ?? [];
}

function productToString(product: Product): string {
  return product.name;
}

export function ProductAutocomplete({ locale }: ProductAutocompleteProps) {
  const t = useTranslations("search");
  const [searchValue, setSearchValue] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);
  const resultsRef = useRef<Product[]>([]);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  resultsRef.current = searchResults;

  const handleFocus = useCallback(() => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    blurTimeoutRef.current = setTimeout(() => {
      setIsFocused(false);
    }, 150);
  }, []);

  useEffect(() => {
    if (searchValue.length < MIN_QUERY_LENGTH) {
      setSearchResults([]);
      setIsLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);

    const timeoutId = setTimeout(async () => {
      try {
        const results = await fetchSearchResults(searchValue);
        if (!controller.signal.aborted) {
          setSearchResults(results);
        }
      } catch {
        if (!controller.signal.aborted) {
          setSearchResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [searchValue]);

  const handleValueChange = useCallback(
    (value: string, eventDetails: { reason?: string }) => {
      setSearchValue(value);

      if (eventDetails.reason === "itemPress") {
        const product = resultsRef.current.find(
          (p) => productToString(p) === value,
        );
        if (product) {
          router.push(`/${locale}/products/${product.id}`);
        }
      }
    },
    [locale, router],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (searchValue.trim()) {
        router.push(
          `/${locale}/search?q=${encodeURIComponent(searchValue.trim())}`,
        );
      }
    },
    [searchValue, locale, router],
  );

  const isDropdownOpen = isFocused && searchValue.length >= MIN_QUERY_LENGTH;

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <Autocomplete
          filter={null}
          inline
          items={isDropdownOpen ? searchResults : []}
          itemToStringValue={productToString}
          onValueChange={handleValueChange}
          value={searchValue}
        >
          <AutocompleteInput
            aria-label={t("placeholder")}
            placeholder={t("placeholder")}
            size="lg"
            className="[&_input]:border-[var(--color-border-hover)] [&_span]:border-[var(--color-border-hover)]"
            startAddon={
              <SearchIcon className="size-5 text-[var(--color-text-muted)]" />
            }
            showClear
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
          <div
            style={{
              overflow: "hidden",
              maxHeight: isDropdownOpen ? "800px" : "0px",
              transition:
                "max-height 400ms cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            <div
              className="rounded-lg border border-[var(--color-border-hover)] bg-[var(--color-bg-surface)] mt-1"
              style={{
                opacity: isDropdownOpen ? 1 : 0,
                transform: isDropdownOpen ? "translateY(0)" : "translateY(-8px)",
                transition:
                  "opacity 250ms ease-out 100ms, transform 250ms ease-out 100ms",
              }}
            >
                <AutocompleteStatus className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
                  {isLoading
                    ? t("searching")
                    : searchResults.length > 0
                      ? `${searchResults.length} ${t("results")}`
                      : ""}
                </AutocompleteStatus>
                <AutocompleteEmpty>
                  <div className="px-2 py-4 text-center">
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {t("autocompleteEmpty")}
                    </p>
                  </div>
                </AutocompleteEmpty>
                <AutocompleteList>
                  {(product: Product) => (
                    <AutocompleteItem
                      key={product.id}
                      value={product}
                      className="cursor-pointer"
                    >
                      <div className="flex w-full items-center gap-3 py-1">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                            {product.name}
                          </div>
                          <div className="truncate text-xs text-[var(--color-text-muted)]">
                            {product.brand && <>{product.brand}</>}
                            {product.brand && product.store_count > 0 && (
                              <> · </>
                            )}
                            {product.store_count > 0 && (
                              <>
                                {product.store_count}{" "}
                                {t("stores", {
                                  count: product.store_count,
                                })}
                              </>
                            )}
                          </div>
                        </div>
                        {product.lowest_price != null && (
                          <span className="shrink-0 text-sm font-semibold text-[var(--color-accent)]">
                            {Number(product.lowest_price).toFixed(2)} ₼
                          </span>
                        )}
                      </div>
                    </AutocompleteItem>
                  )}
                </AutocompleteList>
            </div>
          </div>
        </Autocomplete>
      </form>
    </div>
  );
}

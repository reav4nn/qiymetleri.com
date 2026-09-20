import { useQuery } from "@tanstack/react-query";

import { getCatalogueData, getHomeData, getProductPageData } from "@/api/catalogue";
import {
  getRealCatalogueData,
  getRealHomeData,
  getRealProductPageData,
} from "@/api/real-catalogue";
import type { CatalogueQuery } from "@/api/types";

export const catalogueKeys = {
  all: ["catalogue"] as const,
  home: () => [...catalogueKeys.all, "home"] as const,
  list: (query: CatalogueQuery) => [...catalogueKeys.all, "list", query] as const,
  product: (productId: string) => [...catalogueKeys.all, "product", productId] as const,
};

export function useHomeQuery() {
  return useQuery({
    queryKey: catalogueKeys.home(),
    queryFn: ({ signal }) => getHomeData(signal),
    initialData: getRealHomeData,
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCatalogueQuery(query: CatalogueQuery) {
  return useQuery({
    queryKey: catalogueKeys.list(query),
    queryFn: ({ signal }) => getCatalogueData(query, signal),
    initialData: () => getRealCatalogueData(query),
    initialDataUpdatedAt: 0,
    placeholderData: (previousData) => previousData,
  });
}

export function useProductQuery(productId?: string) {
  return useQuery({
    queryKey: catalogueKeys.product(productId ?? ""),
    queryFn: ({ signal }) => getProductPageData(productId!, signal),
    enabled: Boolean(productId),
    initialData: productId ? () => getRealProductPageData(productId) : undefined,
    initialDataUpdatedAt: 0,
  });
}

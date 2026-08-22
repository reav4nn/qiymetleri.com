import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";

import type { CatalogueQuery } from "@/api/types";
import { CatalogueScreen } from "@/screens/catalogue";

export default function CatalogueRoute() {
  const params = useLocalSearchParams<{
    q?: string;
    category?: string;
    brand?: string;
    store_id?: string;
    sort_by?: CatalogueQuery["sort_by"];
    page?: string;
  }>();
  const router = useRouter();
  const query = useMemo<CatalogueQuery>(
    () => ({
      q: params.q?.trim() || undefined,
      category: params.category || undefined,
      brand: params.brand || undefined,
      store_id: params.store_id || undefined,
      sort_by: params.sort_by ?? "name",
      page: Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1),
    }),
    [params.brand, params.category, params.page, params.q, params.sort_by, params.store_id],
  );

  function updateQuery(updates: Partial<CatalogueQuery>) {
    const next = { ...query, ...updates };
    const routeParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(next)) {
      if (value !== undefined && value !== "") routeParams[key] = String(value);
    }
    router.replace({ pathname: "/products", params: routeParams });
  }

  return (
    <CatalogueScreen
      key={query.q ?? ""}
      query={query}
      onUpdateQuery={updateQuery}
    />
  );
}

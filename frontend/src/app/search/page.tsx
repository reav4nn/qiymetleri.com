import { Suspense } from "react";
import { searchProducts, fetchProducts } from "@/lib/api";
import { ProductCard } from "@/components/ProductCard";
import { SearchBar } from "@/components/SearchBar";

export const revalidate = 300;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = params.q || "";
  const category = params.category || "";
  const page = Number(params.page) || 1;

  const data = query
    ? await searchProducts(query, page)
    : await fetchProducts({ category, page });

  const title = query
    ? `"${query}" üçün nəticələr`
    : category
      ? `${category} kateqoriyası`
      : "Bütün məhsullar";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 max-w-xl">
        <SearchBar />
      </div>

      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <p className="mt-1 text-sm text-gray-500">{data.total} nəticə tapıldı</p>

      <Suspense
        fallback={
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-48 animate-pulse rounded-xl bg-gray-100"
              />
            ))}
          </div>
        }
      >
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </Suspense>

      {data.items.length === 0 && (
        <div className="mt-12 text-center text-gray-500">
          Heç bir nəticə tapılmadı. Fərqli açar sözlərlə yenidən cəhd edin.
        </div>
      )}
    </div>
  );
}

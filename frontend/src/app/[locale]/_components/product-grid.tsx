import { getTranslations } from "next-intl/server";
import type { ProductSummary } from "@/lib/api";
import { ProductCard } from "./product-card";

export async function ProductGrid({ products }: { products: ProductSummary[] }) {
  const t = await getTranslations();
  if (products.length === 0) {
    return (
      <div className="rounded-card border border-border bg-white px-4 py-10 text-center text-sm text-[#71717a]">
        {t("home.emptyProducts")}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

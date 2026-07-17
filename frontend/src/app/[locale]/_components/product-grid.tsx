import { popularProducts } from "@/app/[locale]/_lib/mock-data";
import { ProductCard } from "./product-card";

export function ProductGrid() {
  return (
    <div className="grid grid-cols-4 gap-4">
      {popularProducts.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

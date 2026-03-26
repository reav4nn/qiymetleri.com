import type { Product } from "@/lib/api";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <a
      href={`/products/${product.id}`}
      className="flex flex-col rounded-xl border border-gray-200 p-4 transition hover:border-blue-300 hover:shadow-md"
    >
      <h3 className="text-sm font-medium text-gray-900 line-clamp-2">
        {product.name}
      </h3>
      <div className="mt-1 flex items-center gap-2">
        {product.brand && (
          <span className="text-xs text-gray-500 capitalize">{product.brand}</span>
        )}
        {product.variant_count > 1 && (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
            {product.variant_count} variant
          </span>
        )}
      </div>
      <div className="mt-auto pt-3">
        {product.lowest_price ? (
          <div>
            <span className="text-lg font-bold text-green-600">
              {Number(product.lowest_price).toFixed(2)} ₼
            </span>
            <span className="ml-2 text-xs text-gray-500">
              {product.store_count} mağazada
            </span>
          </div>
        ) : (
          <span className="text-sm text-gray-400">Qiymət yoxdur</span>
        )}
      </div>
    </a>
  );
}

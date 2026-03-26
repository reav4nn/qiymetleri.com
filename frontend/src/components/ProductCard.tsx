import Image from "next/image";
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
      <div className="mb-3 flex h-36 items-center justify-center overflow-hidden rounded-lg bg-gray-50">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            width={144}
            height={144}
            className="h-full w-auto object-contain"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-300">
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
            </svg>
          </div>
        )}
      </div>
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

import { notFound } from "next/navigation";
import { fetchProduct, fetchPriceHistory } from "@/lib/api";
import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import { VariantSelector } from "@/components/VariantSelector";
import type { Metadata } from "next";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const product = await fetchProduct(id);
    const allPrices = product.variants
      .flatMap((v) => v.current_prices)
      .filter((p) => p.in_stock)
      .sort((a, b) => Number(a.price_azn) - Number(b.price_azn));
    const lowest = allPrices[0];

    return {
      title: `${product.name} Azərbaycanda qiymət`,
      description: lowest
        ? `${product.name} ən ucuz: ${Number(lowest.price_azn).toFixed(2)} ₼ — qiymetleri.com`
        : `${product.name} qiymətini müqayisə edin — qiymetleri.com`,
    };
  } catch {
    return { title: "Məhsul tapılmadı" };
  }
}

const STORE_NAMES: Record<string, string> = {
  kontakt_home: "Kontakt Home",
  baku_electronics: "Baku Electronics",
  irshad_electronics: "Irshad Electronics",
  ispace: "iSpace",
};

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let product;
  let priceHistory;
  try {
    [product, priceHistory] = await Promise.all([
      fetchProduct(id),
      fetchPriceHistory(id, 90),
    ]);
  } catch {
    notFound();
  }

  const allPrices = product.variants
    .flatMap((v) => v.current_prices)
    .filter((p) => p.in_stock)
    .sort((a, b) => Number(a.price_azn) - Number(b.price_azn));
  const lowestPrice = allPrices[0];

  const hasVariants = product.variants.length > 1;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-2 text-sm text-gray-500">
        {product.brand && (
          <span className="capitalize">{product.brand} / </span>
        )}
        {product.category && <span>{product.category}</span>}
      </div>

      <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>

      {lowestPrice && (
        <div className="mt-4">
          <span className="text-sm text-gray-500">Ən ucuz qiymət: </span>
          <span className="text-2xl font-bold text-green-600">
            {Number(lowestPrice.price_azn).toFixed(2)} ₼
          </span>
          <span className="ml-2 text-sm text-gray-500">
            ({STORE_NAMES[lowestPrice.store_id] || lowestPrice.store_id})
          </span>
        </div>
      )}

      {/* Variant selector + price table */}
      {hasVariants ? (
        <section className="mt-8">
          <VariantSelector
            variants={product.variants}
            storeNames={STORE_NAMES}
          />
        </section>
      ) : (
        <section className="mt-8">
          <h2 className="text-xl font-semibold text-gray-900">
            Qiymət müqayisəsi
          </h2>
          <PriceTable
            prices={product.current_prices}
            storeNames={STORE_NAMES}
          />
        </section>
      )}

      {/* Price history chart */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold text-gray-900">
          Qiymət tarixçəsi (90 gün)
        </h2>
        <div className="mt-4">
          <PriceHistoryChart data={priceHistory} />
        </div>
      </section>
    </div>
  );
}

function PriceTable({
  prices,
  storeNames,
}: {
  prices: { id: string; store_id: string; price_azn: number; in_stock: boolean; url: string | null; last_checked_at: string }[];
  storeNames: Record<string, string>;
}) {
  const sorted = [...prices].sort(
    (a, b) => Number(a.price_azn) - Number(b.price_azn)
  );

  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full min-w-[500px]">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
              Mağaza
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
              Qiymət
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
              Status
            </th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.map((price, i) => (
            <tr key={price.id} className={i === 0 ? "bg-green-50" : ""}>
              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                {storeNames[price.store_id] || price.store_id}
              </td>
              <td className="px-4 py-3 text-sm font-bold text-gray-900">
                {Number(price.price_azn).toFixed(2)} ₼
              </td>
              <td className="px-4 py-3">
                {price.in_stock ? (
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                    Stokda var
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                    Stokda yoxdur
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                {price.url && (
                  <a
                    href={price.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="whitespace-nowrap rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    Mağazaya keç →
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

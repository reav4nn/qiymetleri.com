import { notFound } from "next/navigation";
import { fetchProduct } from "@/lib/api";
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
    const lowestPrice = product.current_prices
      .filter((p) => p.in_stock)
      .sort((a, b) => a.price_azn - b.price_azn)[0];

    return {
      title: `${product.name} Azərbaycanda qiymət`,
      description: lowestPrice
        ? `${product.name} ən ucuz: ${lowestPrice.price_azn.toFixed(2)} ₼ — qiymetleri.com`
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
  try {
    product = await fetchProduct(id);
  } catch {
    notFound();
  }

  const sortedPrices = [...product.current_prices].sort(
    (a, b) => a.price_azn - b.price_azn
  );
  const lowestPrice = sortedPrices.find((p) => p.in_stock);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-2 text-sm text-gray-500">
        {product.brand && <span>{product.brand} / </span>}
        {product.category && <span>{product.category}</span>}
      </div>

      <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>

      {lowestPrice && (
        <div className="mt-4">
          <span className="text-sm text-gray-500">Ən ucuz qiymət: </span>
          <span className="text-2xl font-bold text-green-600">
            {lowestPrice.price_azn.toFixed(2)} ₼
          </span>
          <span className="ml-2 text-sm text-gray-500">
            ({STORE_NAMES[lowestPrice.store_id] || lowestPrice.store_id})
          </span>
        </div>
      )}

      {/* Price comparison table */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold text-gray-900">
          Qiymət müqayisəsi
        </h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full">
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
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  Yenilənmə
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedPrices.map((price, i) => (
                <tr key={price.id} className={i === 0 ? "bg-green-50" : ""}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {STORE_NAMES[price.store_id] || price.store_id}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-gray-900">
                    {price.price_azn.toFixed(2)} ₼
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
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(price.last_checked_at).toLocaleString("az-AZ")}
                  </td>
                  <td className="px-4 py-3">
                    {price.url && (
                      <a
                        href={price.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-blue-600 hover:text-blue-800"
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
      </section>

      {/* Product attributes */}
      {product.attributes && Object.keys(product.attributes).length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold text-gray-900">Xüsusiyyətlər</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4">
            {Object.entries(product.attributes).map(([key, value]) => (
              <div key={key} className="rounded-lg bg-gray-50 p-3">
                <dt className="text-xs text-gray-500">{key}</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">
                  {String(value)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}

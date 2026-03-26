interface PriceTableProps {
  prices: {
    id: string;
    store_id: string;
    price_azn: number;
    in_stock: boolean;
    url: string | null;
    last_checked_at: string;
  }[];
  storeNames: Record<string, string>;
  labels: {
    store: string;
    price: string;
    status: string;
    inStock: string;
    outOfStock: string;
    goToStore: string;
  };
}

export function PriceTable({ prices, storeNames, labels }: PriceTableProps) {
  const sorted = [...prices].sort(
    (a, b) => Number(a.price_azn) - Number(b.price_azn)
  );

  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full min-w-[500px]">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
              {labels.store}
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
              {labels.price}
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
              {labels.status}
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
                    {labels.inStock}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                    {labels.outOfStock}
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
                    {labels.goToStore}
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

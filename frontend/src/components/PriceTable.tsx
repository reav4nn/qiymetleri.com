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

import { STORE_LOGOS } from "@/lib/store-logos";

export function PriceTable({ prices, storeNames, labels }: PriceTableProps) {
  const sorted = [...prices].sort(
    (a, b) => Number(a.price_azn) - Number(b.price_azn)
  );

  return (
    <>
      {/* Mobile: card layout */}
      <div className="mt-4 space-y-3 sm:hidden">
        {sorted.map((price, i) => (
          <div
            key={price.id}
            className={`rounded-xl border border-[var(--color-border)] p-3 ${
              i === 0 ? "bg-[var(--color-success-subtle)] border-[var(--color-success)]/30" : "bg-[var(--color-bg-surface)]"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
                {STORE_LOGOS[price.store_id] && (
                  <img src={STORE_LOGOS[price.store_id]} alt="" className="h-4 w-4 rounded-sm object-contain" />
                )}
                {storeNames[price.store_id] || price.store_id}
              </span>
              {price.in_stock ? (
                <span className="rounded-full bg-[var(--color-success-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-success)]">
                  {labels.inStock}
                </span>
              ) : (
                <span className="rounded-full bg-[var(--color-danger-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-danger)]">
                  {labels.outOfStock}
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-lg font-bold text-[var(--color-text-primary)]">
                {Number(price.price_azn).toFixed(2)} ₼
              </span>
              {price.url && (
                <a
                  href={price.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-xs font-medium text-white active:scale-95 hover:bg-[var(--color-accent-hover)]"
                >
                  {labels.goToStore}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: table layout */}
      <div className="mt-4 hidden overflow-x-auto rounded-xl border border-[var(--color-border)] sm:block">
        <table className="w-full">
          <thead className="bg-[var(--color-bg-surface)]">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-secondary)]">
                {labels.store}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-secondary)]">
                {labels.price}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-secondary)]">
                {labels.status}
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-subtle)]">
            {sorted.map((price, i) => (
              <tr key={price.id} className={i === 0 ? "bg-[var(--color-success-subtle)]" : ""}>
                <td className="px-4 py-3 text-sm font-medium text-[var(--color-text-primary)]">
                  <span className="inline-flex items-center gap-2">
                    {STORE_LOGOS[price.store_id] && (
                      <img src={STORE_LOGOS[price.store_id]} alt="" className="h-4 w-4 rounded-sm object-contain" />
                    )}
                    {storeNames[price.store_id] || price.store_id}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-bold text-[var(--color-text-primary)]">
                  {Number(price.price_azn).toFixed(2)} ₼
                </td>
                <td className="px-4 py-3">
                  {price.in_stock ? (
                    <span className="inline-flex items-center rounded-full bg-[var(--color-success-subtle)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-success)]">
                      {labels.inStock}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-[var(--color-danger-subtle)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-danger)]">
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
                      className="whitespace-nowrap rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-accent-hover)]"
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
    </>
  );
}

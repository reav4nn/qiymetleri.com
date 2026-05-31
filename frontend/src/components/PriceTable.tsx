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
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
                {STORE_LOGOS[price.store_id] && (
                  <img src={STORE_LOGOS[price.store_id]} alt="" className="h-4 w-4 rounded-sm object-contain" />
                )}
                {storeNames[price.store_id] || price.store_id}
              </span>
              {price.in_stock ? (
                <span className="text-xs text-[var(--color-success)]">{labels.inStock}</span>
              ) : (
                <span className="text-xs text-[var(--color-danger)]">{labels.outOfStock}</span>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-lg font-semibold text-[var(--color-text-primary)]">
                {Number(price.price_azn).toFixed(2)} ₼
              </span>
              {price.url && (
                <a
                  href={price.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-xs font-medium text-[var(--color-text-primary)] transition hover:bg-[var(--color-bg-surface-hover)] active:scale-95"
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
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                {labels.store}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                {labels.price}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                {labels.status}
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {sorted.map((price, i) => (
              <tr key={price.id}>
                <td className="px-4 py-3 text-sm text-[var(--color-text-primary)]">
                  <span className="inline-flex items-center gap-2">
                    {STORE_LOGOS[price.store_id] && (
                      <img src={STORE_LOGOS[price.store_id]} alt="" className="h-4 w-4 rounded-sm object-contain" />
                    )}
                    <span className={i === 0 ? "font-semibold" : ""}>
                      {storeNames[price.store_id] || price.store_id}
                    </span>
                    {i === 0 && (
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-[var(--color-text-primary)]">
                  {Number(price.price_azn).toFixed(2)} ₼
                </td>
                <td className="px-4 py-3">
                  {price.in_stock ? (
                    <span className="text-xs text-[var(--color-success)]">{labels.inStock}</span>
                  ) : (
                    <span className="text-xs text-[var(--color-danger)]">{labels.outOfStock}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {price.url && (
                    <a
                      href={price.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="whitespace-nowrap rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] transition hover:bg-[var(--color-bg-surface-hover)]"
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

"use client";
import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-api";
type MatchProduct = {
  name: string;
  store_id: string;
  url: string | null;
  price: number | string;
};
type Match = {
  id: number;
  family_a: string;
  family_b: string;
  brand: string;
  similarity: number;
  stores_a: string | null;
  stores_b: string | null;
  count_a: number;
  count_b: number;
  products_a: MatchProduct[];
  products_b: MatchProduct[];
};

function ProductList({ products }: { products: MatchProduct[] }) {
  return (
    <ul className="mt-3 space-y-2 border-t border-zinc-200 pt-3">
      {products.map((product, index) => (
        <li key={`${product.store_id}-${product.url}-${index}`}>
          <a
            href={product.url || undefined}
            target="_blank"
            rel="noreferrer"
            className="block rounded-lg p-2 text-sm transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            <span className="block font-semibold text-zinc-800">
              {product.name}
            </span>
            <span className="mt-1 block text-xs text-zinc-500">
              {product.store_id} · {Number(product.price).toFixed(2)} ₼
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function MatchesPage() {
  const [data, setData] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const matches = await adminFetch<Match[]>("/matches/pending");
    setData(matches);
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      await adminFetch("/matches/refresh", { method: "POST" });
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Təkliflər yenilənmədi",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    let active = true;

    adminFetch("/matches/refresh", { method: "POST" })
      .then(() => adminFetch<Match[]>("/matches/pending"))
      .then((matches) => {
        if (active) setData(matches);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error ? reason.message : "Təkliflər yenilənmədi",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function review(id: number, action: "accept" | "reject") {
    setError(null);
    try {
      await adminFetch(`/matches/${id}/${action}`, { method: "POST" });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Əməliyyat alınmadı");
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">
            Məhsul uyğunlaşdırması
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Avtomatik təklifləri qəbul və ya rədd edin.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing || loading}
          className="min-h-11 rounded-xl border bg-white px-4 text-sm font-bold disabled:cursor-wait disabled:opacity-60"
        >
          {refreshing || loading ? "Yenilənir..." : "Təklifləri yenilə"}
        </button>
      </div>
      {error && (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}
      <div className="mt-6 space-y-4">
        {data.map((m) => (
          <section key={m.id} className="rounded-2xl border bg-white p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold">
                {m.brand} · {(m.similarity * 100).toFixed(1)}%
              </span>
              <div className="grid grid-cols-2 gap-3 sm:flex">
                <button
                  onClick={() => review(m.id, "reject")}
                  className="min-h-11 rounded-xl border px-4 text-sm font-bold"
                >
                  Rədd et
                </button>
                <button
                  onClick={() => review(m.id, "accept")}
                  className="min-h-11 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white"
                >
                  Qəbul et
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-zinc-50 p-4">
                <b>{m.family_a}</b>
                <p className="mt-1 text-xs text-zinc-500">
                  {m.count_a} məhsul · {m.stores_a || "Mağaza yoxdur"}
                </p>
                <ProductList products={m.products_a} />
              </div>
              <div className="rounded-xl bg-zinc-50 p-4">
                <b>{m.family_b}</b>
                <p className="mt-1 text-xs text-zinc-500">
                  {m.count_b} məhsul · {m.stores_b || "Mağaza yoxdur"}
                </p>
                <ProductList products={m.products_b} />
              </div>
            </div>
          </section>
        ))}
        {loading && (
          <div className="rounded-2xl border bg-white p-10 text-center text-sm text-zinc-500">
            Uyğunlaşdırma təklifləri hazırlanır...
          </div>
        )}
        {!loading && !error && data.length === 0 && (
          <div className="rounded-2xl border bg-white p-10 text-center text-sm text-zinc-500">
            Yeni uyğunlaşdırma təklifi tapılmadı.
          </div>
        )}
      </div>
    </>
  );
}

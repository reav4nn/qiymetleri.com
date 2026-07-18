"use client";
import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-api";
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
};
export default function MatchesPage() {
  const [data, setData] = useState<Match[]>([]);
  const load = () => adminFetch<Match[]>("/matches/pending").then(setData);
  useEffect(() => {
    void load();
  }, []);
  async function review(id: number, action: "accept" | "reject") {
    await adminFetch(`/matches/${id}/${action}`, { method: "POST" });
    load();
  }
  return (
    <>
      <h1 className="text-2xl font-extrabold sm:text-3xl">
        Məhsul uyğunlaşdırması
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        Avtomatik təklifləri qəbul və ya rədd edin.
      </p>
      <div className="mt-6 space-y-4">
        {data.map((m) => (
          <section key={m.id} className="rounded-2xl border bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold">
                {m.brand} · {(m.similarity * 100).toFixed(1)}%
              </span>
              <div className="flex gap-2">
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
              </div>
              <div className="rounded-xl bg-zinc-50 p-4">
                <b>{m.family_b}</b>
                <p className="mt-1 text-xs text-zinc-500">
                  {m.count_b} məhsul · {m.stores_b || "Mağaza yoxdur"}
                </p>
              </div>
            </div>
          </section>
        ))}
        {data.length === 0 && (
          <div className="rounded-2xl border bg-white p-10 text-center text-sm text-zinc-500">
            Gözləyən uyğunlaşdırma yoxdur.
          </div>
        )}
      </div>
    </>
  );
}

"use client";
import { useEffect, useState } from "react";
import { adminFetch, formatDate } from "@/lib/admin-api";
import { useToast } from "@/components/toast-context";

type Store = {
  id: string;
  name: string;
  base_url: string;
  is_active: boolean;
  product_count: number;
  in_stock_count: number;
  last_crawl: string | null;
  last_price_update: string | null;
};
export default function StoresPage() {
  const { toast } = useToast();
  const [data, setData] = useState<Store[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = () => adminFetch<Store[]>("/stores").then(setData);

  useEffect(() => {
    void load();
  }, []);

  async function toggleStore(s: Store) {
    setTogglingId(s.id);
    const newStatus = !s.is_active;
    try {
      await adminFetch(`/stores/${s.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: newStatus }),
      });
      await load();
      toast(
        `${s.name} mağazası ${newStatus ? "aktivləşdirildi" : "deaktiv edildi"}`,
        "success"
      );
    } catch {
      toast("Mağaza statusunu dəyişərkən xəta baş verdi", "error");
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-extrabold sm:text-3xl">Mağazalar</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Public görünürlük scraper cədvəlindən ayrı idarə olunur.
      </p>
      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        {data.map((s) => (
          <section key={s.id} className="rounded-2xl border bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-extrabold">{s.name}</h2>
                <a
                  href={s.base_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-zinc-500 hover:text-zinc-800 underline transition-colors cursor-pointer"
                >
                  {s.base_url}
                </a>
              </div>
              <button
                disabled={togglingId === s.id}
                onClick={() => toggleStore(s)}
                className={`min-h-11 rounded-xl px-4 text-sm font-bold transition-all cursor-pointer hover:opacity-80 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
                  s.is_active
                    ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                {togglingId === s.id
                  ? "Yenilənir..."
                  : s.is_active
                  ? "Aktiv"
                  : "Deaktiv"}
              </button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-zinc-50 p-3">
                <span className="text-zinc-500">Məhsul</span>
                <b className="block text-xl">{s.product_count}</b>
              </div>
              <div className="rounded-xl bg-zinc-50 p-3">
                <span className="text-zinc-500">Stokda</span>
                <b className="block text-xl">{s.in_stock_count}</b>
              </div>
            </div>
            <p className="mt-4 text-xs text-zinc-500">
              Son qiymət yeniləməsi: {formatDate(s.last_price_update)}
            </p>
          </section>
        ))}
      </div>
    </>
  );
}

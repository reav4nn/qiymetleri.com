"use client";
import { FormEvent, useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-api";
import { useToast } from "@/components/toast-context";

type Product = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  model_family: string | null;
  prices: { store_id: string; price_azn: number; in_stock: boolean }[];
};
type Data = { items: Product[]; total: number; page: number; per_page: number };
export default function ProductsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<Data | null>(null),
    [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<string[]>([]);
  const load = () =>
    adminFetch<Data>(`/products?page=${page}&q=${encodeURIComponent(q)}`).then(
      setData,
    );
  useEffect(() => {
    void load();
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps
  async function search(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    load();
  }
  async function remove(ids: string[]) {
    if (!confirm(`${ids.length} məhsul silinsin?`)) return;
    try {
      await adminFetch(
        ids.length === 1 ? `/products/${ids[0]}` : "/products/batch/delete",
        {
          method: "DELETE",
          body: ids.length === 1 ? undefined : JSON.stringify(ids),
        },
      );
      setSelected([]);
      load();
      toast(
        ids.length === 1 ? "Məhsul silindi" : `${ids.length} məhsul silindi`,
        "success"
      );
    } catch {
      toast("Silinmə zamanı xəta baş verdi", "error");
    }
  }
  return (
    <>
      <h1 className="text-2xl font-extrabold sm:text-3xl">Məhsullar</h1>
      <form onSubmit={search} className="mt-6 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Məhsul adı ilə axtar"
          className="h-12 min-w-0 flex-1 rounded-xl border bg-white px-4"
        />
        <button className="rounded-xl bg-zinc-950 px-5 text-sm font-bold text-white transition-all cursor-pointer hover:bg-zinc-800 active:scale-[0.98]">
          Axtar
        </button>
      </form>
      {selected.length > 0 && (
        <button
          onClick={() => remove(selected)}
          className="mt-4 min-h-11 rounded-xl bg-red-600 px-4 text-sm font-bold text-white transition-all cursor-pointer hover:bg-red-700 active:scale-[0.98]"
        >
          Seçilənləri sil ({selected.length})
        </button>
      )}
      <div className="mt-5 overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="p-3"></th>
              {["Məhsul", "Brend", "Kateqoriya", "Qiymətlər", "Əməliyyat"].map(
                (x) => (
                  <th key={x} className="p-3">
                    {x}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {data?.items.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selected.includes(p.id)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, p.id]
                          : selected.filter((x) => x !== p.id),
                      )
                    }
                    className="cursor-pointer"
                  />
                </td>
                <td className="max-w-sm p-3 font-semibold">{p.name}</td>
                <td className="p-3">{p.brand || "—"}</td>
                <td className="p-3">{p.category || "—"}</td>
                <td className="p-3">
                  {p.prices.map((x) => (
                    <span key={x.store_id} className="mr-2 whitespace-nowrap">
                      {x.price_azn} ₼
                    </span>
                  ))}
                </td>
                <td className="p-3">
                  <button
                    onClick={async () => {
                      const name = prompt("Yeni ad", p.name);
                      if (name) {
                        try {
                          await adminFetch(`/products/${p.id}`, {
                            method: "PATCH",
                            body: JSON.stringify({ name }),
                          });
                          load();
                          toast("Məhsul adı yeniləndi", "success");
                        } catch {
                          toast("Yenilənmə zamanı xəta baş verdi", "error");
                        }
                      }
                    }}
                    className="mr-2 min-h-11 rounded-lg px-3.5 py-1.5 font-bold transition-all cursor-pointer hover:bg-zinc-100 active:scale-[0.98]"
                  >
                    Redaktə
                  </button>
                  <button
                    onClick={() => remove([p.id])}
                    className="min-h-11 rounded-lg px-3.5 py-1.5 font-bold text-red-600 transition-all cursor-pointer hover:bg-red-50 active:scale-[0.98]"
                  >
                    Sil
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <button
          disabled={page === 1}
          onClick={() => setPage((x) => x - 1)}
          className="min-h-11 rounded-xl border bg-white px-4 font-semibold transition-all cursor-pointer hover:bg-zinc-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Əvvəlki
        </button>
        <span className="text-sm">
          Səhifə {page} · {data?.total ?? 0} məhsul
        </span>
        <button
          disabled={!data || page * data.per_page >= data.total}
          onClick={() => setPage((x) => x + 1)}
          className="min-h-11 rounded-xl border bg-white px-4 font-semibold transition-all cursor-pointer hover:bg-zinc-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Növbəti
        </button>
      </div>
    </>
  );
}

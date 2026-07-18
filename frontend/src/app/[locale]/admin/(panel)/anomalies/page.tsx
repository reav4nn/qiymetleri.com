"use client";
import { FormEvent, useEffect, useState } from "react";
import { adminFetch, formatDate } from "@/lib/admin-api";
type Item = {
  product_id: string;
  product_name: string;
  store_id: string;
  old_price: number;
  new_price: number;
  change_pct: number;
  detected_at: string;
};
export default function AnomaliesPage() {
  const [data, setData] = useState<Item[]>([]),
    [threshold, setThreshold] = useState(30),
    [hours, setHours] = useState(24);
  const load = () =>
    adminFetch<Item[]>(`/anomalies?threshold=${threshold}&hours=${hours}`).then(
      setData,
    );
  useEffect(() => {
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  function submit(e: FormEvent) {
    e.preventDefault();
    load();
  }
  return (
    <>
      <h1 className="text-2xl font-extrabold sm:text-3xl">
        Qiymət anomaliyaları
      </h1>
      <form
        onSubmit={submit}
        className="mt-6 grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-3"
      >
        <label className="text-sm font-bold">
          Dəyişiklik faizi
          <input
            type="number"
            min="5"
            max="100"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="mt-1 h-11 w-full rounded-xl border px-3"
          />
        </label>
        <label className="text-sm font-bold">
          Son saat
          <input
            type="number"
            min="1"
            max="168"
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="mt-1 h-11 w-full rounded-xl border px-3"
          />
        </label>
        <button className="min-h-11 self-end rounded-xl bg-zinc-950 px-4 text-sm font-bold text-white">
          Tətbiq et
        </button>
      </form>
      <div className="mt-5 overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="bg-zinc-50">
            <tr>
              {["Məhsul", "Mağaza", "Köhnə", "Yeni", "Dəyişiklik", "Tarix"].map(
                (x) => (
                  <th key={x} className="p-3">
                    {x}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {data.map((x) => (
              <tr key={`${x.product_id}-${x.detected_at}`} className="border-t">
                <td className="p-3 font-semibold">{x.product_name}</td>
                <td className="p-3">{x.store_id}</td>
                <td className="p-3">{x.old_price} ₼</td>
                <td className="p-3">{x.new_price} ₼</td>
                <td className="p-3 font-bold text-red-600">{x.change_pct}%</td>
                <td className="p-3">{formatDate(x.detected_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.length === 0 && (
          <p className="p-8 text-center text-sm text-zinc-500">
            Seçilən aralıqda anomaliya yoxdur.
          </p>
        )}
      </div>
    </>
  );
}

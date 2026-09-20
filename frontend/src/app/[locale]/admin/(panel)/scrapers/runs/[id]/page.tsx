"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { adminFetch, formatDate, statusLabel } from "@/lib/admin-api";
type Run = {
  spider: string;
  status: string;
  started_at: string;
  items_seen: number;
  items_saved: number;
  items_dropped: number;
  errors: number;
  log_tail: string | null;
};
type Category = {
  category: string;
  status: string;
  pages: number;
  items_seen: number;
  items_saved: number;
  errors: number;
};
type Detail = { run: Run; categories: Category[] };
export default function RunPage() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Detail | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const load = () =>
      adminFetch<Detail>(`/scraper-runs/${id}`).then((x) => {
        setD(x);
        timer = setTimeout(
          load,
          ["queued", "running"].includes(x.run.status) ? 5000 : 30000,
        );
      });
    load();
    return () => clearTimeout(timer);
  }, [id]);
  if (!d) return <p>Yüklənir…</p>;
  return (
    <>
      <h1 className="text-2xl font-extrabold sm:text-3xl">Run #{id}</h1>
      <p className="mt-1 text-sm text-zinc-500">
        {d.run.spider} · {statusLabel(d.run.status)} ·{" "}
        {formatDate(d.run.started_at)}
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Görülən", d.run.items_seen],
          ["Saxlanılan", d.run.items_saved],
          ["Atılan", d.run.items_dropped],
          ["Xətalar", d.run.errors],
        ].map(([k, v]) => (
          <div key={k as string} className="rounded-2xl border bg-white p-5">
            <p className="text-sm text-zinc-500">{k}</p>
            <b className="mt-2 block text-2xl">{v ?? 0}</b>
          </div>
        ))}
      </div>
      <section className="mt-6 overflow-hidden rounded-2xl border bg-white">
        <div className="border-b p-5 font-bold">Kateqoriyalar</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead className="bg-zinc-50">
              <tr>
                {[
                  "Kateqoriya",
                  "Status",
                  "Səhifə",
                  "Görülən",
                  "Saxlanılan",
                  "Xəta",
                ].map((x) => (
                  <th key={x} className="p-3">
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.categories.map((c) => (
                <tr key={c.category} className="border-t">
                  <td className="p-3 font-semibold">{c.category}</td>
                  <td className="p-3">{statusLabel(c.status)}</td>
                  <td className="p-3">{c.pages}</td>
                  <td className="p-3">{c.items_seen}</td>
                  <td className="p-3">{c.items_saved}</td>
                  <td className="p-3">{c.errors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="mt-6 rounded-2xl bg-zinc-950 p-5 text-zinc-200">
        <h2 className="font-bold text-white">Log sonluğu</h2>
        <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap text-xs leading-5">
          {d.run.log_tail || "Log hələ mövcud deyil."}
        </pre>
      </section>
    </>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Play, RefreshCw } from "lucide-react";
import { adminFetch, formatDate, statusLabel } from "@/lib/admin-api";
import { useToast } from "@/components/toast-context";

type Spider = {
  spider: string;
  display_name: string;
  is_enabled: boolean;
  schedule_type: string;
  interval_minutes: number | null;
  cron_expression: string | null;
  next_run_at: string | null;
  id: number | null;
  status: string | null;
  items_saved: number | null;
  finished_at: string | null;
};
type Data = {
  worker_online: boolean;
  beat_online: boolean;
  queue_count: number;
  scrapers: Spider[];
};
export default function ScrapersPage() {
  const { toast } = useToast();
  const { locale } = useParams<{ locale: string }>();
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(
    () =>
      adminFetch<Data>("/scrapers")
        .then(setData)
        .catch((e) => setError(e.message)),
    [],
  );
  useEffect(() => {
    load();
    const active = data?.scrapers.some((s) =>
      ["queued", "running"].includes(s.status ?? ""),
    );
    const timer = setInterval(load, active ? 5000 : 30000);
    return () => clearInterval(timer);
  }, [load, data?.scrapers]);
  async function run(name: string) {
    setBusy(name);
    setError("");
    try {
      await adminFetch(`/scrapers/${name}/runs`, { method: "POST" });
      await load();
      toast(`${name} scraper-i işə salındı`, "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Xəta";
      setError(msg);
      toast(msg, "error");
    } finally {
      setBusy("");
    }
  }
  async function save(s: Spider, form: HTMLFormElement) {
    const fd = new FormData(form);
    setBusy(s.spider);
    try {
      await adminFetch(`/scrapers/${s.spider}/schedule`, {
        method: "PATCH",
        body: JSON.stringify({
          is_enabled: fd.get("enabled") === "on",
          schedule_type: fd.get("type"),
          interval_minutes:
            fd.get("type") === "interval" ? Number(fd.get("interval")) : null,
          cron_expression: fd.get("type") === "cron" ? fd.get("cron") : null,
        }),
      });
      await load();
      toast(`${s.display_name} cədvəli saxlanıldı`, "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Xəta";
      setError(msg);
      toast(msg, "error");
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">Scraperlər</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Canlı run-lar və avtomatik cədvəllər
          </p>
        </div>
        <button
          disabled={busy === "all"}
          onClick={async () => {
            setBusy("all");
            try {
              await adminFetch("/scrapers/run-all", { method: "POST" });
              await load();
              toast("Bütün scraperlər işə salındı", "success");
            } catch (e) {
              const msg = e instanceof Error ? e.message : "Xəta";
              toast(msg, "error");
            } finally {
              setBusy("");
            }
          }}
          className="min-h-11 rounded-xl bg-red-600 px-5 text-sm font-bold text-white transition-all cursor-pointer hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Play className="mr-2 inline" size={17} />
          {busy === "all" ? "İşə salınır..." : "Hamısını işə sal"}
        </button>
      </div>
      {error && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          ["Worker", data?.worker_online],
          ["Beat", data?.beat_online],
          ["Növbə", data?.queue_count],
        ].map(([k, v]) => (
          <div key={k as string} className="rounded-2xl border bg-white p-4">
            <span className="text-sm text-zinc-500">{k}</span>
            <b className="float-right">
              {typeof v === "boolean" ? (v ? "Online" : "Offline") : (v ?? "-")}
            </b>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        {data?.scrapers.map((s) => (
          <section
            key={s.spider}
            className="rounded-2xl border bg-white p-5 sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold">{s.display_name}</h2>
                <p className="text-xs text-zinc-500">{s.spider}</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${s.status === "success" ? "bg-emerald-50 text-emerald-700" : s.status === "failed" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}
              >
                {statusLabel(s.status)}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-zinc-50 p-3">
                <span className="text-zinc-500">Son məhsul</span>
                <b className="block text-lg">{s.items_saved ?? 0}</b>
              </div>
              <div className="rounded-xl bg-zinc-50 p-3">
                <span className="text-zinc-500">Növbəti run</span>
                <b className="block text-xs">{formatDate(s.next_run_at)}</b>
              </div>
            </div>
            <form
              className="mt-5 grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                save(s, e.currentTarget);
              }}
            >
              <label className="text-xs font-bold">
                Cədvəl növü
                <select
                  name="type"
                  defaultValue={s.schedule_type}
                  className="mt-1 h-11 w-full rounded-xl border bg-white px-3 cursor-pointer"
                >
                  <option value="interval">Interval</option>
                  <option value="cron">Cron</option>
                </select>
              </label>
              <label className="text-xs font-bold">
                Interval (dəqiqə)
                <input
                  name="interval"
                  type="number"
                  min="30"
                  defaultValue={s.interval_minutes ?? 240}
                  className="mt-1 h-11 w-full rounded-xl border px-3"
                />
              </label>
              <label className="text-xs font-bold sm:col-span-2">
                Cron ifadəsi
                <input
                  name="cron"
                  defaultValue={s.cron_expression ?? "0 */4 * * *"}
                  className="mt-1 h-11 w-full rounded-xl border px-3 font-mono"
                />
              </label>
              <label className="flex min-h-11 items-center gap-2 text-sm font-semibold cursor-pointer select-none">
                <input
                  name="enabled"
                  type="checkbox"
                  defaultChecked={s.is_enabled}
                  className="cursor-pointer"
                />
                Avtomatik run aktivdir
              </label>
              <button
                disabled={busy === s.spider}
                className="min-h-11 rounded-xl border bg-white px-4 text-sm font-bold transition-all cursor-pointer hover:bg-zinc-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy === s.spider ? "Saxlanılır..." : "Cədvəli saxla"}
              </button>
            </form>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => run(s.spider)}
                disabled={busy === s.spider}
                className="min-h-11 flex-1 rounded-xl bg-zinc-950 px-4 text-sm font-bold text-white transition-all cursor-pointer hover:bg-zinc-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className={`mr-2 inline ${busy === s.spider ? "animate-spin" : ""}`} size={16} />
                {busy === s.spider ? "İşə salınır..." : "İndi işə sal"}
              </button>
              {s.id && (
                <Link
                  href={`/${locale}/admin/scrapers/runs/${s.id}`}
                  className="grid min-h-11 place-items-center rounded-xl border bg-white px-4 text-sm font-bold transition-all cursor-pointer hover:bg-zinc-100 active:scale-[0.98]"
                >
                  Detallar
                </Link>
              )}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

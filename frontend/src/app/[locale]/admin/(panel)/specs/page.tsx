"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, FileUp, RefreshCw } from "lucide-react";
import { adminFetch, formatDate } from "@/lib/admin-api";
import { useToast } from "@/components/toast-context";

type Observation = {
  id: string;
  status: string;
  original_value: string;
  original_unit: string | null;
  source_type: string;
  source_url: string;
  observed_at: string;
  confidence: number | string;
};

type SpecCase = {
  id: string;
  case_type: string;
  status: string;
  entity_type: string;
  entity_id: string;
  definition_key: string | null;
  model_brand: string | null;
  model_name: string | null;
  due_at: string | null;
  created_at: string;
  selected_observation_id: string | null;
  observations: Observation[];
};

type PageResult<T> = { items: T[]; total: number };

function CaseCard({
  item,
  onResolved,
}: {
  item: SpecCase;
  onResolved: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [selected, setSelected] = useState(
    item.observations.find((entry) => entry.status === "conflict")?.id ??
      item.observations[0]?.id ??
      "",
  );
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const overdue = Boolean(item.due_at && new Date(item.due_at) < new Date());

  async function resolve(action: "accept" | "reject" | "dismiss") {
    if (reason.trim().length < 3) {
      toast("Qərar səbəbi ən azı 3 simvol olmalıdır", "error");
      return;
    }
    if (action !== "dismiss" && !selected) {
      toast("Observation seçin", "error");
      return;
    }
    setSaving(true);
    try {
      await adminFetch(`/specs/cases/${item.id}/resolve`, {
        method: "POST",
        body: JSON.stringify({
          action,
          observation_id: action === "dismiss" ? null : selected,
          reason: reason.trim(),
        }),
      });
      toast("Moderasiya qərarı auditə yazıldı", "success");
      await onResolved();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Qərar saxlanmadı", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">
              {item.case_type}
            </span>
            {overdue && (
              <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800">
                SLA keçib
              </span>
            )}
          </div>
          <h2 className="mt-2 break-words text-base font-extrabold sm:text-lg">
            {item.model_brand || item.entity_type}{" "}
            {item.model_name || item.entity_id}
          </h2>
          <p className="mt-1 break-all text-sm text-zinc-500">
            {item.definition_key || "Model mapping"} · son tarix{" "}
            {formatDate(item.due_at)}
          </p>
        </div>
        <span className="shrink-0 text-xs text-zinc-400">
          {formatDate(item.created_at)}
        </span>
      </div>

      <fieldset className="mt-4 space-y-3">
        <legend className="text-sm font-bold">Mənbə müşahidələri</legend>
        {item.observations.length === 0 && (
          <p className="rounded-xl bg-zinc-50 p-3 text-sm text-zinc-500">
            Bu case üçün observation yoxdur.
          </p>
        )}
        {item.observations.map((observation) => (
          <label
            key={observation.id}
            className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors focus-within:border-red-500 hover:bg-zinc-50"
          >
            <input
              type="radio"
              name={`observation-${item.id}`}
              value={observation.id}
              checked={selected === observation.id}
              onChange={() => setSelected(observation.id)}
              className="mt-1 size-4 shrink-0 accent-red-600"
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2 text-sm font-bold">
                <span className="break-all">{observation.original_value}</span>
                {observation.original_unit && (
                  <span className="text-zinc-500">{observation.original_unit}</span>
                )}
                {item.selected_observation_id === observation.id && (
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                    canonical
                  </span>
                )}
              </span>
              <span className="mt-1 block break-all text-xs text-zinc-500">
                {observation.source_type} · {formatDate(observation.observed_at)} ·{" "}
                confidence {String(observation.confidence)}
              </span>
              <a
                href={observation.source_url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block break-all text-xs text-blue-700 underline focus:outline-2"
              >
                {observation.source_url}
              </a>
            </span>
          </label>
        ))}
      </fieldset>

      <label className="mt-4 block text-sm font-bold">
        Qərar səbəbi
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={2}
          placeholder="Mənbə və dəyər seçiminin səbəbini yazın"
          className="mt-1 min-h-20 w-full resize-y rounded-xl border px-3 py-2 font-normal outline-none focus:border-red-500"
        />
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => void resolve("accept")}
          disabled={saving || !selected}
          className="min-h-11 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800 focus:outline-2 disabled:opacity-50"
        >
          Seçiləni qəbul et
        </button>
        <button
          type="button"
          onClick={() => void resolve("reject")}
          disabled={saving || !selected}
          className="min-h-11 rounded-xl border border-red-200 px-4 text-sm font-bold text-red-700 hover:bg-red-50 focus:outline-2 disabled:opacity-50"
        >
          Seçiləni rədd et
        </button>
        <button
          type="button"
          onClick={() => void resolve("dismiss")}
          disabled={saving}
          className="min-h-11 rounded-xl border px-4 text-sm font-bold hover:bg-zinc-50 focus:outline-2 disabled:opacity-50"
        >
          Case-i bağla
        </button>
      </div>
    </article>
  );
}

function ImportPanel({ onCommitted }: { onCommitted: () => Promise<void> }) {
  const { toast } = useToast();
  const [source, setSource] = useState(
    '[\n  {\n    "model_id": "UUID",\n    "definition_key": "display.refresh_rate",\n    "value": 120,\n    "unit": "hz"\n  }\n]',
  );
  const [reason, setReason] = useState("");
  const [token, setToken] = useState("");
  const [diff, setDiff] = useState<Record<string, unknown>[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [busy, setBusy] = useState(false);

  async function validate() {
    setBusy(true);
    try {
      const parsed = JSON.parse(source);
      if (!Array.isArray(parsed)) throw new Error("JSON root array olmalıdır");
      const result = await adminFetch<{
        token: string;
        diff: Record<string, unknown>[];
      }>("/specs/imports/validate", {
        method: "POST",
        body: JSON.stringify({ rows: parsed }),
      });
      setRows(parsed);
      setToken(result.token);
      setDiff(result.diff);
      toast(`${result.diff.length} sətir validasiyadan keçdi`, "success");
    } catch (error) {
      setToken("");
      setDiff([]);
      toast(error instanceof Error ? error.message : "Import valid deyil", "error");
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (reason.trim().length < 3) {
      toast("Import səbəbi ən azı 3 simvol olmalıdır", "error");
      return;
    }
    setBusy(true);
    try {
      const result = await adminFetch<{ rows: number }>(
        `/specs/imports/${encodeURIComponent(token)}/commit`,
        {
          method: "POST",
          body: JSON.stringify({ rows, reason: reason.trim() }),
        },
      );
      toast(`${result.rows} sətir atomik import edildi`, "success");
      setToken("");
      setDiff([]);
      setReason("");
      await onCommitted();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Import edilmədi", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="rounded-2xl border bg-white shadow-sm">
      <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-4 font-extrabold sm:px-5">
        <FileUp size={19} aria-hidden />
        İki mərhələli manual JSON import
      </summary>
      <div className="border-t p-4 sm:p-5">
        <p className="max-w-3xl text-sm leading-relaxed text-zinc-600">
          Əvvəl validate dry-run diff yaradır. Commit yalnız eyni payload və 30
          dəqiqəlik signed token ilə bir transaction-da işləyir.
        </p>
        <label className="mt-4 block text-sm font-bold">
          Import sətirləri
          <textarea
            value={source}
            onChange={(event) => {
              setSource(event.target.value);
              setToken("");
              setDiff([]);
            }}
            rows={10}
            spellCheck={false}
            className="mt-1 w-full rounded-xl border bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-100 outline-none focus:border-red-500"
          />
        </label>
        <button
          type="button"
          onClick={() => void validate()}
          disabled={busy}
          className="mt-3 min-h-11 w-full rounded-xl border px-5 text-sm font-bold hover:bg-zinc-50 focus:outline-2 disabled:opacity-50 sm:w-auto"
        >
          Validate və diff göstər
        </button>
        {diff.length > 0 && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="flex items-center gap-2 text-sm font-bold text-emerald-900">
              <CheckCircle2 size={18} aria-hidden />
              {diff.length} sətir commit üçün hazırdır
            </p>
            <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-all text-xs text-emerald-950">
              {JSON.stringify(diff, null, 2)}
            </pre>
          </div>
        )}
        {token && (
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="text-sm font-bold">
              Audit səbəbi
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Məsələn: data-owner təsdiqli pilot importu"
                className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal outline-none focus:border-red-500"
              />
            </label>
            <button
              type="button"
              onClick={() => void commit()}
              disabled={busy}
              className="min-h-11 rounded-xl bg-red-600 px-5 text-sm font-bold text-white hover:bg-red-700 focus:outline-2 disabled:opacity-50"
            >
              Atomik commit et
            </button>
          </div>
        )}
      </div>
    </details>
  );
}

export default function SpecsAdminPage() {
  const [items, setItems] = useState<SpecCase[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminFetch<PageResult<SpecCase>>(
        "/specs/cases?status=open&per_page=100",
      );
      setItems(result.items);
      setTotal(result.total);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Case-lər yüklənmədi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial remote synchronization; load owns the request lifecycle states.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-600">
            Data governance
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
            Spesifikasiya moderasiyası
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600">
            Conflict, freshness və incomplete case-ləri; mənbə müşahidələri və
            auditli manual import.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-white px-4 text-sm font-bold hover:bg-zinc-50 focus:outline-2 disabled:opacity-50"
        >
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          Yenilə
        </button>
      </header>

      <ImportPanel onCommitted={load} />

      <section aria-labelledby="open-cases-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="open-cases-title" className="text-lg font-extrabold">
            Açıq case-lər
          </h2>
          <span className="rounded-full bg-zinc-200 px-3 py-1 text-xs font-bold">
            {total}
          </span>
        </div>
        {error && (
          <p
            role="alert"
            className="mb-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            <AlertCircle size={18} aria-hidden />
            {error}
          </p>
        )}
        {loading && items.length === 0 ? (
          <div className="rounded-2xl border bg-white p-8 text-center text-sm text-zinc-500">
            Case-lər yüklənir…
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <CheckCircle2 className="mx-auto text-emerald-700" aria-hidden />
            <p className="mt-2 font-bold text-emerald-950">
              Açıq blocking case yoxdur
            </p>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {items.map((item) => (
              <CaseCard key={item.id} item={item} onResolved={load} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

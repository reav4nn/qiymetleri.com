"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-api";
import { useToast } from "@/components/toast-context";

type MappingReview = {
  id: string;
  confidence: number | string | null;
  reason: string | null;
  created_at: string;
  product_id: string;
  product_name: string;
  canonical_id: string;
  product_brand: string | null;
  product_category: string | null;
  model_family: string | null;
  current_model_id: string | null;
  current_model_brand: string | null;
  current_model_name: string | null;
  current_model_status: string | null;
  proposed_model_id: string | null;
  proposed_model_brand: string | null;
  proposed_model_name: string | null;
  proposed_model_status: string | null;
};

type ProductModel = {
  id: string;
  category_id: string;
  brand: string;
  name: string;
  status: string;
  variant_count: number;
};

type PageResult<T> = {
  items: T[];
  total: number;
};

function ReviewCard({
  review,
  onResolved,
}: {
  review: MappingReview;
  onResolved: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [query, setQuery] = useState(review.product_brand ?? "");
  const [models, setModels] = useState<ProductModel[]>([]);
  const [targetModelId, setTargetModelId] = useState(
    review.proposed_model_id ?? "",
  );
  const [resolutionReason, setResolutionReason] = useState(
    "Admin model mapping review",
  );
  const [searchEmpty, setSearchEmpty] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newBrand, setNewBrand] = useState(review.product_brand ?? "");
  const [newModelName, setNewModelName] = useState("");
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function searchModels(event: FormEvent) {
    event.preventDefault();
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      setError("Axtarış üçün ən azı 2 simvol yazın.");
      return;
    }

    setSearching(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        status: "verified",
        q: normalizedQuery,
        limit: "200",
      });
      if (review.product_category) {
        params.set("category_id", review.product_category);
      }
      const result = await adminFetch<PageResult<ProductModel>>(
        `/product-models?${params.toString()}`,
      );
      setModels(result.items);
      setSearchEmpty(result.items.length === 0);
      if (result.items.length === 0) {
        setTargetModelId("");
        const [possibleBrand, ...possibleName] = normalizedQuery.split(/\s+/);
        if (!newBrand && possibleName.length > 0) {
          setNewBrand(possibleBrand);
          setNewModelName(possibleName.join(" "));
        } else if (!newModelName) {
          setNewModelName(normalizedQuery);
        }
      } else if (!result.items.some((model) => model.id === targetModelId)) {
        setTargetModelId(result.items[0].id);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Axtarış alınmadı");
    } finally {
      setSearching(false);
    }
  }

  async function createModel(event: FormEvent) {
    event.preventDefault();
    const brand = newBrand.trim();
    const name = newModelName.trim();
    const reason = resolutionReason.trim();
    if (!review.product_category) {
      setError("Məhsulun kateqoriyası yoxdur; model yaratmaq mümkün deyil.");
      return;
    }
    if (!brand || !name) {
      setError("Yeni model üçün brend və model adını yazın.");
      return;
    }
    if (reason.length < 3) {
      setError("Qərarın səbəbi ən azı 3 simvol olmalıdır.");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const created = await adminFetch<Omit<ProductModel, "variant_count">>(
        "/product-models",
        {
          method: "POST",
          body: JSON.stringify({
            category_id: review.product_category,
            brand,
            name,
            status: "verified",
            reason,
          }),
        },
      );
      const model = { ...created, variant_count: 0 };
      setModels([model]);
      setTargetModelId(model.id);
      setSearchEmpty(false);
      setShowCreate(false);
      toast("Yeni canonical model yaradıldı və seçildi", "success");
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : "Model yaradıla bilmədi";
      setError(message);
      toast(message, "error");
    } finally {
      setCreating(false);
    }
  }

  async function resolve(action: "assign" | "reject") {
    const reason = resolutionReason.trim();
    if (reason.length < 3) {
      setError("Qərarın səbəbi ən azı 3 simvol olmalıdır.");
      return;
    }
    if (action === "assign" && !targetModelId) {
      setError("Əvvəlcə hədəf modeli seçin.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await adminFetch(`/model-mapping-reviews/${review.id}/resolve`, {
        method: "POST",
        body: JSON.stringify({
          action,
          target_model_id: action === "assign" ? targetModelId : null,
          reason,
        }),
      });
      toast(
        action === "assign"
          ? "Məhsul modelə bağlandı"
          : "Model mapping review rədd edildi",
        action === "assign" ? "success" : "info",
      );
      await onResolved();
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : "Əməliyyat alınmadı";
      setError(message);
      toast(message, "error");
    } finally {
      setSaving(false);
    }
  }

  const confidence = Number(review.confidence);

  return (
    <section className="rounded-2xl border bg-white p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
        <span className="rounded-full bg-zinc-100 px-3 py-1">
          {review.product_category ?? "Kateqoriyasız"}
        </span>
        {Number.isFinite(confidence) && (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-800">
            Etibar: {(confidence * 100).toFixed(1)}%
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl bg-zinc-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
            Məhsul
          </p>
          <h2 className="mt-2 font-bold text-zinc-900">{review.product_name}</h2>
          <p className="mt-1 text-sm text-zinc-600">
            {review.product_brand ?? "Brend yoxdur"} ·{" "}
            <span className="break-all">{review.canonical_id}</span>
          </p>
          <p className="mt-3 text-xs text-zinc-500">
            Cari model: {review.current_model_brand ?? "-"} {review.current_model_name ?? "-"}
            {review.current_model_status
              ? ` (${review.current_model_status})`
              : ""}
          </p>
          {review.reason && (
            <p className="mt-2 text-xs text-zinc-500">Səbəb: {review.reason}</p>
          )}
        </div>

        <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
            Hədəf canonical model
          </p>
          {review.proposed_model_id && (
            <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg bg-white p-3 text-sm">
              <input
                type="radio"
                name={`target-${review.id}`}
                value={review.proposed_model_id}
                checked={targetModelId === review.proposed_model_id}
                onChange={(event) => setTargetModelId(event.target.value)}
                className="mt-1"
              />
              <span>
                <b>{review.proposed_model_brand} {review.proposed_model_name}</b>
                <span className="block text-xs text-zinc-500">Təklif edilən model</span>
              </span>
            </label>
          )}

          <form onSubmit={searchModels} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Brend və ya model adı"
              aria-label="Canonical model axtarışı"
              className="min-h-11 min-w-0 flex-1 rounded-xl border bg-white px-3 text-sm outline-none focus:border-emerald-600"
            />
            <button
              type="submit"
              disabled={searching || creating || saving}
              className="min-h-11 rounded-xl border bg-white px-4 text-sm font-bold transition-colors hover:bg-zinc-50 disabled:cursor-wait disabled:opacity-60"
            >
              {searching ? "Axtarılır..." : "Model axtar"}
            </button>
          </form>

          {models.length > 0 && (
            <select
              value={targetModelId}
              onChange={(event) => setTargetModelId(event.target.value)}
              aria-label="Hədəf canonical model"
              className="mt-3 min-h-11 w-full rounded-xl border bg-white px-3 text-sm"
            >
              {review.proposed_model_id && (
                <option value={review.proposed_model_id}>
                  {review.proposed_model_brand} {review.proposed_model_name} (təklif)
                </option>
              )}
              {models
                .filter((model) => model.id !== review.proposed_model_id)
                .map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.brand} {model.name} · {model.variant_count} variant
                  </option>
                ))}
            </select>
          )}

          {searchEmpty && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p>
                Təsdiqlənmiş model tapılmadı. Rəsmi model adı dəqiqdirsə, yeni
                canonical model yarada bilərsiniz.
              </p>
              {!showCreate && (
                <button
                  type="button"
                  onClick={() => setShowCreate(true)}
                  className="mt-3 min-h-11 rounded-xl border border-amber-300 bg-white px-4 font-bold transition-colors hover:bg-amber-100"
                >
                  Yeni canonical model yarat
                </button>
              )}
            </div>
          )}

          {showCreate && (
            <form
              onSubmit={createModel}
              className="mt-3 space-y-3 rounded-xl border border-amber-200 bg-white p-3"
            >
              <p className="text-xs text-zinc-500">
                Yalnız istehsalçının rəsmi model adını yazın. Rəng və mağaza
                kodunu model adına əlavə etməyin.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-bold text-zinc-600">
                  Brend
                  <input
                    value={newBrand}
                    onChange={(event) => setNewBrand(event.target.value)}
                    placeholder="Məsələn: Logitech"
                    className="mt-1 min-h-11 w-full rounded-xl border px-3 text-sm font-normal outline-none focus:border-emerald-600"
                  />
                </label>
                <label className="text-xs font-bold text-zinc-600">
                  Rəsmi model adı
                  <input
                    value={newModelName}
                    onChange={(event) => setNewModelName(event.target.value)}
                    placeholder="Məsələn: G321 LIGHTSPEED"
                    className="mt-1 min-h-11 w-full rounded-xl border px-3 text-sm font-normal outline-none focus:border-emerald-600"
                  />
                </label>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  disabled={creating}
                  className="min-h-11 rounded-xl border px-4 text-sm font-bold hover:bg-zinc-50 disabled:opacity-60"
                >
                  Ləğv et
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="min-h-11 rounded-xl bg-amber-600 px-4 text-sm font-bold text-white hover:bg-amber-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {creating ? "Yaradılır..." : "Modeli yarat və seç"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end">
        <label className="min-w-0 flex-1 text-xs font-bold text-zinc-600">
          Qərarın səbəbi
          <input
            value={resolutionReason}
            onChange={(event) => setResolutionReason(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-xl border px-3 text-sm font-normal outline-none focus:border-emerald-600"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => void resolve("reject")}
            disabled={saving}
            className="min-h-11 rounded-xl border px-4 text-sm font-bold transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-wait disabled:opacity-60"
          >
            Rədd et
          </button>
          <button
            type="button"
            onClick={() => void resolve("assign")}
            disabled={saving || !targetModelId}
            className="min-h-11 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saxlanılır..." : "Modelə bağla"}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}

export default function MatchesPage() {
  const { toast } = useToast();
  const [data, setData] = useState<MappingReview[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await adminFetch<PageResult<MappingReview>>(
        "/model-mapping-reviews?status=pending&limit=200",
      );
      setData(result.items);
      setTotal(result.total);
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : "Review siyahısı yüklənmədi";
      setError(message);
      throw reason;
    }
  }, []);

  useEffect(() => {
    let active = true;
    adminFetch<PageResult<MappingReview>>(
      "/model-mapping-reviews?status=pending&limit=200",
    )
      .then((result) => {
        if (active) {
          setData(result.items);
          setTotal(result.total);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Review siyahısı yüklənmədi",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [load]);

  async function refresh() {
    setLoading(true);
    try {
      await load();
      toast("Model mapping review-lər yeniləndi", "success");
    } catch {
      // load() already exposes the API error in the page.
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">
            Model mapping review-lər
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Məhsulları canonical modellərə bağlayın və ya review-ni rədd edin.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="min-h-11 rounded-xl border bg-white px-4 text-sm font-bold transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60"
        >
          {loading ? "Yüklənir..." : `Siyahını yenilə (${total})`}
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
        {data.map((review) => (
          <ReviewCard key={review.id} review={review} onResolved={load} />
        ))}
        {loading && data.length === 0 && (
          <div className="rounded-2xl border bg-white p-10 text-center text-sm text-zinc-500">
            Model mapping review-lər yüklənir...
          </div>
        )}
        {!loading && !error && data.length === 0 && (
          <div className="rounded-2xl border bg-white p-10 text-center text-sm text-zinc-500">
            Gözləyən model mapping review yoxdur.
          </div>
        )}
      </div>
    </>
  );
}

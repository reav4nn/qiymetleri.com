"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  RecentProduct,
  ScraperOverview,
  SpiderStatus,
  TaskResult,
  TriggerResponse,
} from "@/lib/admin-api";

const API_BASE = "";

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "indicə";
  if (mins < 60) return `${mins} dəq əvvəl`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} saat əvvəl`;
  return `${Math.floor(hours / 24)} gün əvvəl`;
}

function statusBadge(status: string | null, isRunning: boolean) {
  if (isRunning)
    return (
      <span
        style={{
          padding: "2px 8px",
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          backgroundColor: "var(--color-accent-subtle, rgba(99,102,241,0.15))",
          color: "var(--color-accent, #6366f1)",
        }}
      >
        İşləyir
      </span>
    );
  if (status === "success" || status === "SUCCESS")
    return (
      <span
        style={{
          padding: "2px 8px",
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          backgroundColor: "var(--color-success-subtle, rgba(34,197,94,0.15))",
          color: "var(--color-success, #22c55e)",
        }}
      >
        Uğurlu
      </span>
    );
  if (status === "FAILURE" || status === "failed")
    return (
      <span
        style={{
          padding: "2px 8px",
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          backgroundColor: "var(--color-danger-subtle, rgba(239,68,68,0.15))",
          color: "var(--color-danger, #ef4444)",
        }}
      >
        Xəta
      </span>
    );
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: 12,
        color: "var(--color-text-muted, #6a6a80)",
      }}
    >
      {status || "—"}
    </span>
  );
}

export default function ScraperPage() {
  const [overview, setOverview] = useState<ScraperOverview | null>(null);
  const [history, setHistory] = useState<TaskResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null);
  const [recentProducts, setRecentProducts] = useState<RecentProduct[]>([]);
  const [recentOpen, setRecentOpen] = useState(false);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentMinutes, setRecentMinutes] = useState(60);

  const refresh = useCallback(async () => {
    try {
      const [ov, hist] = await Promise.all([
        fetch(`${API_BASE}/api/v1/admin/scraper/status`, { cache: "no-store" }).then(
          (r) => r.json() as Promise<ScraperOverview>
        ),
        fetch(`${API_BASE}/api/v1/admin/scraper/history?limit=30`, {
          cache: "no-store",
        }).then((r) => r.json() as Promise<TaskResult[]>),
      ]);
      setOverview(ov);
      setHistory(hist);
    } catch {
      // silently retry on next refresh
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleTrigger = async (spider: string) => {
    setTriggering(spider);
    setTriggerMsg(null);
    try {
      const res: TriggerResponse = await fetch(
        `${API_BASE}/api/v1/admin/scraper/trigger/${spider}`,
        { method: "POST" }
      ).then((r) => r.json());
      setTriggerMsg(`${res.message} (task: ${res.task_id.slice(0, 8)}...)`);
      setTimeout(refresh, 2000);
    } catch {
      setTriggerMsg(`Spider trigger xətası: ${spider}`);
    } finally {
      setTriggering(null);
    }
  };

  const fetchRecent = async (mins: number) => {
    setRecentLoading(true);
    try {
      const data = await fetch(
        `${API_BASE}/api/v1/admin/products/recent?minutes=${mins}`,
        { cache: "no-store" }
      ).then((r) => r.json() as Promise<RecentProduct[]>);
      setRecentProducts(data);
      setRecentOpen(true);
    } catch {
      setRecentProducts([]);
    } finally {
      setRecentLoading(false);
    }
  };

  if (loading) {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Scraper</h1>
        <p style={{ color: "var(--color-text-muted)" }}>Yüklənir...</p>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <h1 className="admin-page-title" style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
          Scraper İdarəetmə
        </h1>
        <button
          onClick={refresh}
          style={{
            padding: "10px 18px",
            borderRadius: 8,
            border: "1px solid var(--color-border, #2a2a3e)",
            backgroundColor: "var(--color-bg-surface, #16161e)",
            color: "var(--color-text-secondary)",
            cursor: "pointer",
            fontSize: 13,
            minHeight: 44,
          }}
        >
          Yenilə
        </button>
      </div>

      {/* Worker status banner */}
      <div
        style={{
          padding: "12px 16px",
          borderRadius: 10,
          marginBottom: 20,
          backgroundColor: overview?.worker_online
            ? "var(--color-success-subtle)"
            : "var(--color-bg-surface-hover)",
          color: overview?.worker_online
            ? "var(--color-success)"
            : "var(--color-text-muted)",
          fontSize: 14,
          fontWeight: 600,
          border: "1px solid var(--color-border)",
        }}
      >
        {overview?.worker_online
          ? `Celery Worker aktiv — ${overview.active_tasks} aktiv task, ${overview.scheduled_tasks} planlaşdırılmış`
          : "Celery Worker qoşulu deyil — spider-lar GitHub Actions ilə işləyir"}
      </div>

      {triggerMsg && (
        <div
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            marginBottom: 16,
            backgroundColor: "var(--color-accent-subtle)",
            color: "var(--color-accent)",
            fontSize: 13,
          }}
        >
          {triggerMsg}
        </div>
      )}

      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
        Spider Statusu
      </h2>

      {/* Spider status — desktop table */}
      <div
        className="admin-table-desktop"
        style={{
          backgroundColor: "var(--color-bg-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: 12,
          overflow: "hidden",
          marginBottom: 32,
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr
              style={{ borderBottom: "1px solid var(--color-border)" }}
            >
              {["Spider", "Status", "Son icrası", "Məhsul", "Müddət", "Cədvəl", ""].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "10px 14px",
                      fontSize: 11,
                      color: "var(--color-text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {overview?.spiders.map((s: SpiderStatus) => (
              <tr
                key={s.name}
                style={{
                  borderBottom: "1px solid var(--color-border-subtle)",
                }}
              >
                <td style={{ padding: "12px 14px", fontSize: 14, fontWeight: 600 }}>
                  {s.display_name}
                </td>
                <td style={{ padding: "12px 14px" }}>
                  {statusBadge(s.last_status, s.is_running)}
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    fontSize: 13,
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {timeAgo(s.last_run)}
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {s.last_item_count ?? "—"}
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    fontSize: 13,
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {s.last_duration ? `${s.last_duration.toFixed(1)}s` : "—"}
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    fontSize: 12,
                    color: "var(--color-text-muted)",
                  }}
                >
                  {s.schedule}
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <button
                    onClick={() => handleTrigger(s.name)}
                    disabled={triggering === s.name || s.is_running}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 6,
                      border: "none",
                      backgroundColor:
                        triggering === s.name || s.is_running
                          ? "var(--color-bg-input)"
                          : "var(--color-accent)",
                      color:
                        triggering === s.name || s.is_running
                          ? "var(--color-text-muted)"
                          : "var(--color-bg-page)",
                      cursor:
                        triggering === s.name || s.is_running
                          ? "not-allowed"
                          : "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {triggering === s.name ? "..." : "Başlat"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Spider status — mobile cards */}
      <div className="admin-cards-mobile" style={{ marginBottom: 32 }}>
        {overview?.spiders.map((s: SpiderStatus) => (
          <div
            key={s.name}
            style={{
              backgroundColor: "var(--color-bg-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              padding: 16,
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{s.display_name}</div>
              {statusBadge(s.last_status, s.is_running)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Son icrası</div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{timeAgo(s.last_run)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Məhsul</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{s.last_item_count ?? "—"}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Müddət</div>
                <div style={{ fontSize: 13 }}>{s.last_duration ? `${s.last_duration.toFixed(1)}s` : "—"}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Cədvəl</div>
                <div style={{ fontSize: 12 }}>{s.schedule}</div>
              </div>
            </div>
            <button
              onClick={() => handleTrigger(s.name)}
              disabled={triggering === s.name || s.is_running}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 8,
                border: "none",
                minHeight: 48,
                backgroundColor:
                  triggering === s.name || s.is_running
                    ? "var(--color-bg-input)"
                    : "var(--color-accent)",
                color:
                  triggering === s.name || s.is_running
                    ? "var(--color-text-muted)"
                    : "var(--color-bg-page)",
                cursor:
                  triggering === s.name || s.is_running
                    ? "not-allowed"
                    : "pointer",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {triggering === s.name ? "Göndərilir..." : "Başlat"}
            </button>
          </div>
        ))}
      </div>

      {/* Task history */}
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
        Son Tapşırıqlar
      </h2>

      {history.length === 0 ? (
        <div
          style={{
            padding: 24,
            textAlign: "center",
            color: "var(--color-text-muted)",
            fontSize: 14,
            backgroundColor: "var(--color-bg-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: 12,
          }}
        >
          Tapşırıq tarixçəsi tapılmadı
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div
            className="admin-table-desktop"
            style={{
              backgroundColor: "var(--color-bg-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                  {["Spider", "Status", "Vaxt", "Məhsul", "Müddət", "Task ID"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "10px 14px",
                          fontSize: 11,
                          color: "var(--color-text-muted)",
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {history.map((t) => (
                  <tr
                    key={t.task_id}
                    style={{
                      borderBottom: "1px solid var(--color-border-subtle)",
                    }}
                  >
                    <td style={{ padding: "10px 14px", fontSize: 13 }}>
                      {t.spider}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      {statusBadge(t.status, false)}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        fontSize: 12,
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      {t.completed_at
                        ? new Date(t.completed_at).toLocaleString("az-AZ", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td
                      style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600 }}
                    >
                      {t.item_count ?? "—"}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        fontSize: 12,
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      {t.duration ? `${t.duration.toFixed(1)}s` : "—"}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        fontSize: 11,
                        fontFamily: "monospace",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      {t.task_id.slice(0, 12)}…
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="admin-cards-mobile">
            {history.map((t) => (
              <div
                key={t.task_id}
                style={{
                  backgroundColor: "var(--color-bg-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 10,
                  padding: 14,
                  marginBottom: 10,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{t.spider}</span>
                  {statusBadge(t.status, false)}
                </div>
                <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--color-text-secondary)" }}>
                  <span>
                    {t.completed_at
                      ? new Date(t.completed_at).toLocaleString("az-AZ", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </span>
                  <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>
                    {t.item_count ?? "—"} məhsul
                  </span>
                  <span>{t.duration ? `${t.duration.toFixed(1)}s` : "—"}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Recent products section */}
      <div style={{ marginTop: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
            Son Yenilənən Məhsullar
          </h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select
              value={recentMinutes}
              onChange={(e) => setRecentMinutes(Number(e.target.value))}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--color-bg-surface)",
                color: "var(--color-text-primary)",
                fontSize: 13,
                minHeight: 40,
              }}
            >
              <option value={30}>Son 30 dəq</option>
              <option value={60}>Son 1 saat</option>
              <option value={120}>Son 2 saat</option>
              <option value={240}>Son 4 saat</option>
              <option value={480}>Son 8 saat</option>
              <option value={1440}>Son 24 saat</option>
            </select>
            <button
              onClick={() => fetchRecent(recentMinutes)}
              disabled={recentLoading}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                backgroundColor: "var(--color-accent)",
                color: "var(--color-bg-page)",
                cursor: recentLoading ? "not-allowed" : "pointer",
                fontSize: 13,
                fontWeight: 600,
                minHeight: 40,
                opacity: recentLoading ? 0.6 : 1,
              }}
            >
              {recentLoading ? "Yüklənir..." : "Göstər"}
            </button>
          </div>
        </div>

        {recentOpen && (
          recentProducts.length === 0 ? (
            <div
              style={{
                padding: 24,
                textAlign: "center",
                color: "var(--color-text-muted)",
                fontSize: 14,
                backgroundColor: "var(--color-bg-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 12,
              }}
            >
              Bu müddətdə yenilənən məhsul tapılmadı
            </div>
          ) : (
            <>
              <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 12 }}>
                {recentProducts.length} məhsul tapıldı
              </div>

              {/* Desktop table */}
              <div
                className="admin-table-desktop"
                style={{
                  backgroundColor: "var(--color-bg-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                      {["Məhsul", "Brend", "Kateqoriya", "Mağaza", "Qiymət", "Stok"].map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: "left",
                            padding: "10px 14px",
                            fontSize: 11,
                            color: "var(--color-text-muted)",
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentProducts.map((p) => (
                      <tr
                        key={`${p.product_id}-${p.store_id}`}
                        style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
                      >
                        <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.url ? (
                            <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-accent)", textDecoration: "none" }}>
                              {p.name}
                            </a>
                          ) : p.name}
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: 13, color: "var(--color-text-secondary)" }}>
                          {p.brand || "—"}
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: 13, color: "var(--color-text-secondary)", textTransform: "capitalize" }}>
                          {p.category || "—"}
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: 13 }}>
                          {p.store_name}
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600 }}>
                          {p.price ? `${p.price.toFixed(2)} ₼` : "—"}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 600,
                              backgroundColor: p.in_stock
                                ? "var(--color-success-subtle)"
                                : "var(--color-danger-subtle)",
                              color: p.in_stock
                                ? "var(--color-success)"
                                : "var(--color-danger)",
                            }}
                          >
                            {p.in_stock ? "Var" : "Yox"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="admin-cards-mobile">
                {recentProducts.map((p) => (
                  <div
                    key={`${p.product_id}-${p.store_id}`}
                    style={{
                      backgroundColor: "var(--color-bg-surface)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 10,
                      padding: 14,
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, lineHeight: 1.3 }}>
                      {p.url ? (
                        <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-accent)", textDecoration: "none" }}>
                          {p.name}
                        </a>
                      ) : p.name}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                      <span style={{ color: "var(--color-text-secondary)" }}>{p.store_name}</span>
                      <span style={{ fontWeight: 600 }}>{p.price ? `${p.price.toFixed(2)} ₼` : "—"}</span>
                    </div>
                    {(p.brand || p.category) && (
                      <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
                        {[p.brand, p.category].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}

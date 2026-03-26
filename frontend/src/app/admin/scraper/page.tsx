"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  ScraperOverview,
  SpiderStatus,
  TaskResult,
  TriggerResponse,
} from "@/lib/admin-api";

const API_BASE =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
    : "http://localhost:8000";

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
        ⏳ İşləyir
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
        ✅ Uğurlu
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
        ❌ Xəta
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
      setTriggerMsg(`✅ ${res.message} (task: ${res.task_id.slice(0, 8)}...)`);
      setTimeout(refresh, 2000);
    } catch {
      setTriggerMsg(`❌ Spider trigger xətası: ${spider}`);
    } finally {
      setTriggering(null);
    }
  };

  if (loading) {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>🕷️ Scraper</h1>
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
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
          🕷️ Scraper İdarəetmə
        </h1>
        <button
          onClick={refresh}
          style={{
            padding: "6px 14px",
            borderRadius: 8,
            border: "1px solid var(--color-border, #2a2a3e)",
            backgroundColor: "var(--color-bg-surface, #16161e)",
            color: "var(--color-text-secondary)",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          🔄 Yenilə
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
            : "var(--color-danger-subtle)",
          color: overview?.worker_online
            ? "var(--color-success)"
            : "var(--color-danger)",
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        {overview?.worker_online
          ? `✅ Celery Worker aktiv — ${overview.active_tasks} aktiv task, ${overview.scheduled_tasks} planlaşdırılmış`
          : "❌ Celery Worker offline — spider-lar işləyə bilmir!"}
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

      {/* Spider status table */}
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
        Spider Statusu
      </h2>
      <div
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
                          : "#fff",
                      cursor:
                        triggering === s.name || s.is_running
                          ? "not-allowed"
                          : "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {triggering === s.name ? "..." : "▶ Başlat"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Task history */}
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
        Son Tapşırıqlar
      </h2>
      <div
        style={{
          backgroundColor: "var(--color-bg-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {history.length === 0 ? (
          <div
            style={{
              padding: 24,
              textAlign: "center",
              color: "var(--color-text-muted)",
              fontSize: 14,
            }}
          >
            Tapşırıq tarixçəsi tapılmadı
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}

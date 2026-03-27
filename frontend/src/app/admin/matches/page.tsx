"use client";

import { useEffect, useState, useCallback } from "react";
import {
  fetchMatchStats,
  fetchPendingMatches,
  reviewMatch,
  type MatchStats,
  type ProductMatch,
  type MatchProduct,
} from "@/lib/admin-api";

function FamilyCard({ family, stores, count, products }: {
  family: string;
  stores: string | null;
  count: number;
  products: MatchProduct[];
}) {
  return (
    <div
      style={{
        background: "var(--color-bg-main)",
        padding: "10px 12px",
        borderRadius: 6,
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{family}</div>
      <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 6 }}>
        {stores || "N/A"} &middot; {count} variant{count !== 1 ? "s" : ""}
      </div>
      {products.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {products.map((p, i) => (
            <div key={i} style={{ fontSize: 11, display: "flex", justifyContent: "space-between", gap: 6, alignItems: "baseline" }}>
              <span style={{ color: "var(--color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                {p.url ? (
                  <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-accent)", textDecoration: "none" }}>
                    {p.name}
                  </a>
                ) : p.name}
              </span>
              <span style={{ color: "var(--color-text-muted)", whiteSpace: "nowrap", fontSize: 10 }}>
                {p.store_id} · {Number(p.price).toFixed(0)} ₼
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MatchesPage() {
  const [stats, setStats] = useState<MatchStats | null>(null);
  const [matches, setMatches] = useState<ProductMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<Set<number>>(new Set());

  const refresh = useCallback(async () => {
    try {
      const [s, m] = await Promise.all([fetchMatchStats(), fetchPendingMatches(50)]);
      setStats(s);
      setMatches(m);
    } catch (e) {
      console.error("Failed to fetch matches:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleReview = async (id: number, action: "accept" | "reject") => {
    setProcessing((prev) => new Set(prev).add(id));
    try {
      await reviewMatch(id, action);
      setMatches((prev) => prev.filter((m) => m.id !== id));
      setStats((prev) =>
        prev
          ? {
              ...prev,
              pending: prev.pending - 1,
              [action === "accept" ? "accepted" : "rejected"]:
                prev[action === "accept" ? "accepted" : "rejected"] + 1,
            }
          : prev
      );
    } catch (e) {
      console.error(`Failed to ${action} match:`, e);
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Product Matching</h1>
        <p style={{ color: "var(--color-text-muted)" }}>Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Product Matching</h1>

      {/* Stats */}
      {stats && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
            gap: 12,
            marginBottom: 24,
          }}
        >
          {[
            { label: "Pending", value: stats.pending, color: "#f59e0b" },
            { label: "Accepted", value: stats.accepted, color: "#10b981" },
            { label: "Rejected", value: stats.rejected, color: "#ef4444" },
            { label: "Total", value: stats.total, color: "var(--color-accent)" },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                padding: "12px 16px",
              }}
            >
              <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 4 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Pending matches */}
      {matches.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: 40,
            color: "var(--color-text-muted)",
            background: "var(--color-bg-surface)",
            borderRadius: 8,
            border: "1px solid var(--color-border)",
          }}
        >
          No pending matches to review.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {matches.map((m) => (
            <div
              key={m.id}
              style={{
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                padding: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      background: "var(--color-accent)",
                      color: "white",
                      padding: "2px 8px",
                      borderRadius: 4,
                      marginRight: 8,
                    }}
                  >
                    {m.brand}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--color-text-muted)",
                    }}
                  >
                    Similarity: {(m.similarity * 100).toFixed(1)}%
                  </span>
                </div>
                <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>#{m.id}</span>
              </div>

              {/* Two families */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "start" }}>
                <FamilyCard family={m.family_a} stores={m.stores_a} count={m.count_a} products={m.products_a} />

                <div style={{ fontSize: 18, color: "var(--color-text-muted)", textAlign: "center", paddingTop: 12 }}>
                  =?
                </div>

                <FamilyCard family={m.family_b} stores={m.stores_b} count={m.count_b} products={m.products_b} />
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
                <button
                  onClick={() => handleReview(m.id, "reject")}
                  disabled={processing.has(m.id)}
                  style={{
                    padding: "6px 16px",
                    borderRadius: 6,
                    border: "1px solid var(--color-border)",
                    background: "transparent",
                    color: "#ef4444",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    opacity: processing.has(m.id) ? 0.5 : 1,
                  }}
                >
                  Reject
                </button>
                <button
                  onClick={() => handleReview(m.id, "accept")}
                  disabled={processing.has(m.id)}
                  style={{
                    padding: "6px 16px",
                    borderRadius: 6,
                    border: "none",
                    background: "#10b981",
                    color: "white",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    opacity: processing.has(m.id) ? 0.5 : 1,
                  }}
                >
                  Accept (Merge)
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

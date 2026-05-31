"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AdminProduct,
  ProductUpdatePayload,
} from "@/lib/admin-api";
import {
  fetchAdminProducts,
  updateProduct,
  deleteProduct,
  batchDeleteProducts,
} from "@/lib/admin-api";

const CATEGORIES = ["smartphones", "laptops", "headphones", "smartwatches"];
const PER_PAGE = 25;

export default function ProductsPage() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editProduct, setEditProduct] = useState<AdminProduct | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const load = useCallback(async (p: number, q: string, cat: string) => {
    setLoading(true);
    try {
      const data = await fetchAdminProducts({
        page: p,
        per_page: PER_PAGE,
        q: q || undefined,
        category: cat || undefined,
      });
      setProducts(data.items);
      setTotal(data.total);
      setSelected(new Set());
    } catch (e: unknown) {
      flash("err", e instanceof Error ? e.message : "Yüklənmədi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page, search, category);
  }, [page, category, load]);

  const onSearchChange = (val: string) => {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      load(1, val, category);
    }, 400);
  };

  const flash = (type: "ok" | "err", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu məhsulu silmək istədiyinizə əminsiniz?")) return;
    setDeleting(id);
    try {
      await deleteProduct(id);
      flash("ok", "Məhsul silindi");
      load(page, search, category);
    } catch {
      flash("err", "Silinmədi");
    } finally {
      setDeleting(null);
    }
  };

  const handleBatchDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`${selected.size} məhsulu silmək istədiyinizə əminsiniz?`)) return;
    try {
      const res = await batchDeleteProducts(Array.from(selected));
      flash("ok", `${res.deleted} məhsul silindi`);
      load(page, search, category);
    } catch {
      flash("err", "Toplu silmə uğursuz oldu");
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === products.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(products.map((p) => p.id)));
    }
  };

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <h1 className="admin-page-title" style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
          Məhsullar
        </h1>
        <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{total} nəticə</span>
      </div>

      {/* Toast */}
      {message && (
        <div style={{
          padding: "10px 16px", borderRadius: 8, marginBottom: 12, fontSize: 13, fontWeight: 600,
          backgroundColor: message.type === "ok" ? "var(--color-success-subtle)" : "var(--color-danger-subtle)",
          color: message.type === "ok" ? "var(--color-success)" : "var(--color-danger)",
        }}>
          {message.text}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Axtar..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            flex: 1, minWidth: 180, padding: "8px 12px", fontSize: 13,
            borderRadius: 8, border: "1px solid var(--color-border)",
            backgroundColor: "var(--color-bg-input)", color: "var(--color-text-primary)",
            outline: "none",
          }}
        />
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          style={{
            padding: "8px 12px", fontSize: 13, borderRadius: 8,
            border: "1px solid var(--color-border)",
            backgroundColor: "var(--color-bg-input)", color: "var(--color-text-primary)",
          }}
        >
          <option value="">Bütün kateqoriyalar</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {selected.size > 0 && (
          <button onClick={handleBatchDelete} style={{
            padding: "8px 16px", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "none",
            backgroundColor: "var(--color-danger)", color: "var(--color-bg-page)", cursor: "pointer",
          }}>
            Sil ({selected.size})
          </button>
        )}
      </div>

      {/* Loading */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-muted)" }}>Yüklənir...</div>
      ) : products.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-muted)" }}>Məhsul tapılmadı</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="admin-table-desktop" style={{
            backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border)",
            borderRadius: 12, overflow: "hidden",
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <th style={{ ...thStyle, width: 36 }}>
                    <input type="checkbox" checked={selected.size === products.length && products.length > 0} onChange={toggleAll} />
                  </th>
                  {["Ad", "Brend", "Kateqoriya", "Qiymət", "Mağaza", ""].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                    <td style={{ ...tdStyle, width: 36 }}>
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} />
                    </td>
                    <td style={{ ...tdStyle, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>
                      {p.name}
                    </td>
                    <td style={{ ...tdStyle, color: "var(--color-text-secondary)" }}>{p.brand || "—"}</td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                        backgroundColor: "var(--color-accent-subtle)", color: "var(--color-accent)",
                      }}>
                        {p.category}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>
                      {p.prices.length > 0
                        ? `${Math.min(...p.prices.map((pr) => pr.price_azn)).toFixed(2)} ₼`
                        : "—"}
                    </td>
                    <td style={{ ...tdStyle, color: "var(--color-text-muted)", fontSize: 12 }}>
                      {p.prices.map((pr) => pr.store_id).join(", ")}
                    </td>
                    <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                      <button onClick={() => setEditProduct(p)} style={btnEdit}>Redaktə</button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={deleting === p.id}
                        style={btnDel}
                      >
                        {deleting === p.id ? "..." : "Sil"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="admin-cards-mobile">
            {products.map((p) => (
              <div key={p.id} style={{
                backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border)",
                borderRadius: 10, padding: 14, marginBottom: 10,
              }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} style={{ marginTop: 3 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
                      {p.brand || "—"} · {p.category}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>
                      {p.prices.length > 0 ? `${Math.min(...p.prices.map((pr) => pr.price_azn)).toFixed(2)} ₼` : "—"}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--color-text-muted)", marginLeft: 6 }}>
                      {p.prices.map((pr) => pr.store_id).join(", ")}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setEditProduct(p)} style={btnEdit}>Redaktə</button>
                    <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id} style={btnDel}>
                      {deleting === p.id ? "..." : "Sil"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                style={{ ...btnPage, opacity: page <= 1 ? 0.4 : 1 }}
              >
                ← Əvvəl
              </button>
              <span style={{ padding: "8px 12px", fontSize: 13, color: "var(--color-text-secondary)" }}>
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                style={{ ...btnPage, opacity: page >= totalPages ? 0.4 : 1 }}
              >
                Sonrakı →
              </button>
            </div>
          )}
        </>
      )}

      {/* Edit modal */}
      {editProduct && (
        <EditModal
          product={editProduct}
          onClose={() => setEditProduct(null)}
          onSaved={() => {
            setEditProduct(null);
            flash("ok", "Məhsul yeniləndi");
            load(page, search, category);
          }}
          onError={(msg) => flash("err", msg)}
        />
      )}
    </div>
  );
}

// ── Edit Modal ──

function EditModal({
  product,
  onClose,
  onSaved,
  onError,
}: {
  product: AdminProduct;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [form, setForm] = useState({
    name: product.name,
    brand: product.brand || "",
    category: product.category || "",
    model_family: product.model_family || "",
    image_url: product.image_url || "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: ProductUpdatePayload = {};
      if (form.name !== product.name) payload.name = form.name;
      if (form.brand !== (product.brand || "")) payload.brand = form.brand;
      if (form.category !== (product.category || "")) payload.category = form.category;
      if (form.model_family !== (product.model_family || "")) payload.model_family = form.model_family;
      if (form.image_url !== (product.image_url || "")) payload.image_url = form.image_url;

      if (Object.keys(payload).length === 0) {
        onClose();
        return;
      }

      await updateProduct(product.id, payload);
      onSaved();
    } catch {
      onError("Yenilənmədi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        backgroundColor: "rgba(0,0,0,0.5)", display: "flex",
        alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "var(--color-bg-surface)", borderRadius: 14,
          padding: 24, width: "100%", maxWidth: 480,
          border: "1px solid var(--color-border)",
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 0, marginBottom: 20 }}>Məhsulu redaktə et</h2>

        {[
          { key: "name", label: "Ad" },
          { key: "brand", label: "Brend" },
          { key: "model_family", label: "Model Family" },
          { key: "image_url", label: "Şəkil URL" },
        ].map(({ key, label }) => (
          <div key={key} style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 4 }}>{label}</label>
            <input
              value={form[key as keyof typeof form]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              style={inputStyle}
            />
          </div>
        ))}

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 4 }}>Kateqoriya</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            style={inputStyle}
          >
            <option value="">—</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Prices (read-only) */}
        {product.prices.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 6 }}>Qiymətlər</label>
            {product.prices.map((pr) => (
              <div key={pr.store_id} style={{
                display: "flex", justifyContent: "space-between", padding: "4px 0",
                fontSize: 13, color: "var(--color-text-secondary)",
              }}>
                <span>{pr.store_id}</span>
                <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{pr.price_azn.toFixed(2)} ₼</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "8px 16px", fontSize: 13, borderRadius: 8, border: "1px solid var(--color-border)",
            backgroundColor: "transparent", color: "var(--color-text-secondary)", cursor: "pointer",
          }}>
            Ləğv et
          </button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: "8px 20px", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "none",
            backgroundColor: "var(--color-accent)", color: "var(--color-bg-page)", cursor: "pointer",
            opacity: saving ? 0.6 : 1,
          }}>
            {saving ? "Yadda saxlanılır..." : "Yadda saxla"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Styles ──

const thStyle: React.CSSProperties = {
  textAlign: "left", padding: "10px 14px", fontSize: 11,
  color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: 0.5,
};

const tdStyle: React.CSSProperties = {
  padding: "10px 14px", fontSize: 13,
};

const btnEdit: React.CSSProperties = {
  padding: "4px 10px", fontSize: 12, fontWeight: 600, borderRadius: 6,
  border: "1px solid var(--color-border)", backgroundColor: "transparent",
  color: "var(--color-accent)", cursor: "pointer", marginRight: 4,
};

const btnDel: React.CSSProperties = {
  padding: "4px 10px", fontSize: 12, fontWeight: 600, borderRadius: 6,
  border: "none", backgroundColor: "var(--color-danger-subtle)",
  color: "var(--color-danger)", cursor: "pointer",
};

const btnPage: React.CSSProperties = {
  padding: "8px 16px", fontSize: 13, borderRadius: 8,
  border: "1px solid var(--color-border)", backgroundColor: "var(--color-bg-surface)",
  color: "var(--color-text-primary)", cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px", fontSize: 13, borderRadius: 8,
  border: "1px solid var(--color-border)", backgroundColor: "var(--color-bg-input)",
  color: "var(--color-text-primary)", outline: "none",
};

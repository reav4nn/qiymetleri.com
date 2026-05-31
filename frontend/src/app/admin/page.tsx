import { fetchDashboard } from "@/lib/admin-api";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div
      style={{
        backgroundColor: "var(--color-bg-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 12,
        padding: "20px 24px",
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "var(--color-text-muted)",
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: "var(--color-text-primary)",
        }}
      >
        {value}
      </div>
      {sub && (
        <div
        style={{
          fontSize: 12,
          color: "var(--color-text-secondary)",
          marginTop: 4,
        }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

export default async function AdminDashboard() {
  let stats;
  try {
    stats = await fetchDashboard();
  } catch {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Dashboard</h1>
        <div
          style={{
            padding: 24,
            backgroundColor: "var(--color-danger-subtle)",
            borderRadius: 12,
            color: "var(--color-danger)",
          }}
        >
          Backend API-yə qoşulmaq mümkün olmadı. Serverin işlədiyindən əmin olun.
        </div>
      </div>
    );
  }

  const imagesPct = stats.total_products > 0
    ? Math.round((stats.products_with_images / stats.total_products) * 100)
    : 0;

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>
        Dashboard
      </h1>

      {/* Stat cards grid */}
      <div
        className="admin-stat-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}
      >
        <StatCard
          label="Məhsullar"
          value={stats.total_products.toLocaleString()}
          sub={`${stats.total_variants} unikal qrup`}
        />
        <StatCard
          label="Mağazalar"
          value={`${stats.active_stores}/${stats.total_stores}`}
          sub="Aktiv / Ümumi"
        />
        <StatCard
          label="Qiymətlər"
          value={stats.total_prices.toLocaleString()}
          sub={
            stats.price_range_min && stats.price_range_max
              ? `${stats.price_range_min.toFixed(0)}–${stats.price_range_max.toFixed(0)} ₼`
              : "—"
          }
        />
        <StatCard
          label="Şəkillər"
          value={`${imagesPct}%`}
          sub={`${stats.products_with_images}/${stats.total_products}`}
        />
        <StatCard
          label="Son yenilənmə"
          value={
            stats.last_price_update
              ? new Date(stats.last_price_update).toLocaleTimeString("az-AZ", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"
          }
          sub={
            stats.last_price_update
              ? new Date(stats.last_price_update).toLocaleDateString("az-AZ")
              : ""
          }
        />
      </div>

      {/* Categories table */}
      <h2
        style={{
          fontSize: 18,
          fontWeight: 600,
          marginBottom: 16,
          color: "var(--color-text-primary, #f0f0f5)",
        }}
      >
        Kateqoriyalar
      </h2>
      <div
        style={{
          backgroundColor: "var(--color-bg-surface, #16161e)",
          border: "1px solid var(--color-border, #2a2a3e)",
          borderRadius: 12,
          overflow: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 300 }}>
          <thead>
            <tr
              style={{
                borderBottom: "1px solid var(--color-border, #2a2a3e)",
              }}
            >
              <th
                style={{
                  textAlign: "left",
                  padding: "12px 16px",
                  fontSize: 12,
                  color: "var(--color-text-muted, #6a6a80)",
                  textTransform: "uppercase",
                }}
              >
                Kateqoriya
              </th>
              <th
                style={{
                  textAlign: "right",
                  padding: "12px 16px",
                  fontSize: 12,
                  color: "var(--color-text-muted, #6a6a80)",
                  textTransform: "uppercase",
                }}
              >
                Sayı
              </th>
              <th
                style={{
                  textAlign: "right",
                  padding: "12px 16px",
                  fontSize: 12,
                  color: "var(--color-text-muted, #6a6a80)",
                  textTransform: "uppercase",
                }}
              >
                %
              </th>
            </tr>
          </thead>
          <tbody>
            {stats.categories.map((cat) => (
              <tr
                key={cat.name}
                style={{
                  borderBottom: "1px solid var(--color-border-subtle, rgba(255,255,255,0.06))",
                }}
              >
                <td
                  style={{
                    padding: "10px 16px",
                    fontSize: 14,
                    textTransform: "capitalize",
                  }}
                >
                  {cat.name}
                </td>
                <td
                  style={{
                    padding: "10px 16px",
                    fontSize: 14,
                    textAlign: "right",
                    fontWeight: 600,
                  }}
                >
                  {cat.count}
                </td>
                <td
                  style={{
                    padding: "10px 16px",
                    fontSize: 14,
                    textAlign: "right",
                    color: "var(--color-text-secondary, #9a9ab0)",
                  }}
                >
                  {stats.total_products > 0
                    ? Math.round((cat.count / stats.total_products) * 100)
                    : 0}
                  %
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

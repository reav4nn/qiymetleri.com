import { fetchAnomalies } from "@/lib/admin-api";

export const dynamic = "force-dynamic";

export default async function AnomaliesPage() {
  let anomalies;
  try {
    anomalies = await fetchAnomalies(30, 48);
  } catch {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>
          Qiymət Anomaliyaları
        </h1>
        <div
          style={{
            padding: 24,
            backgroundColor: "var(--color-danger-subtle)",
            borderRadius: 12,
            color: "var(--color-danger)",
          }}
        >
          API-yə qoşulmaq mümkün olmadı.
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
        Qiymət Anomaliyaları
      </h1>
      <p
        style={{
          fontSize: 14,
          color: "var(--color-text-secondary)",
          marginBottom: 24,
        }}
      >
        Son 48 saat ərzində qiyməti 30%-dən çox dəyişən məhsullar
      </p>

      {anomalies.length === 0 ? (
        <div
          style={{
            padding: 32,
            textAlign: "center",
            backgroundColor: "var(--color-success-subtle)",
            borderRadius: 12,
            color: "var(--color-success)",
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          Anomaliya tapılmadı — bütün qiymətlər normal aralıqdadır.
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
                  {[
                    "Məhsul",
                    "Mağaza",
                    "Köhnə qiymət",
                    "Yeni qiymət",
                    "Dəyişim",
                    "Vaxt",
                  ].map((h) => (
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
                {anomalies.map((a, i) => {
                  const isIncrease = a.new_price > a.old_price;
                  return (
                    <tr
                      key={`${a.product_id}-${a.store_id}-${i}`}
                      style={{
                        borderBottom:
                          "1px solid var(--color-border-subtle)",
                      }}
                    >
                      <td
                        style={{
                          padding: "10px 14px",
                          fontSize: 13,
                          fontWeight: 600,
                          maxWidth: 250,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {a.product_name}
                      </td>
                      <td
                        style={{
                          padding: "10px 14px",
                          fontSize: 13,
                          color: "var(--color-text-secondary)",
                        }}
                      >
                        {a.store_id}
                      </td>
                      <td
                        style={{
                          padding: "10px 14px",
                          fontSize: 13,
                          color: "var(--color-text-secondary)",
                        }}
                      >
                        {a.old_price.toFixed(2)} ₼
                      </td>
                      <td
                        style={{
                          padding: "10px 14px",
                          fontSize: 13,
                          fontWeight: 600,
                        }}
                      >
                        {a.new_price.toFixed(2)} ₼
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 700,
                            backgroundColor: isIncrease
                              ? "var(--color-danger-subtle)"
                              : "var(--color-success-subtle)",
                            color: isIncrease
                              ? "var(--color-danger)"
                              : "var(--color-success)",
                          }}
                        >
                          {isIncrease ? "↑" : "↓"} {a.change_pct.toFixed(1)}%
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "10px 14px",
                          fontSize: 12,
                          color: "var(--color-text-muted)",
                        }}
                      >
                        {new Date(a.detected_at).toLocaleString("az-AZ", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="admin-cards-mobile">
            {anomalies.map((a, i) => {
              const isIncrease = a.new_price > a.old_price;
              return (
                <div
                  key={`${a.product_id}-${a.store_id}-${i}`}
                  style={{
                    backgroundColor: "var(--color-bg-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 10,
                    padding: 14,
                    marginBottom: 10,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, lineHeight: 1.3 }}>
                    {a.product_name}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{a.store_id}</div>
                    <span
                      style={{
                        padding: "3px 10px",
                        borderRadius: 6,
                        fontSize: 13,
                        fontWeight: 700,
                        backgroundColor: isIncrease
                          ? "var(--color-danger-subtle)"
                          : "var(--color-success-subtle)",
                        color: isIncrease
                          ? "var(--color-danger)"
                          : "var(--color-success)",
                      }}
                    >
                      {isIncrease ? "↑" : "↓"} {a.change_pct.toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "var(--color-text-secondary)" }}>
                      {a.old_price.toFixed(2)} ₼ → <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{a.new_price.toFixed(2)} ₼</span>
                    </span>
                    <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                      {new Date(a.detected_at).toLocaleString("az-AZ", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

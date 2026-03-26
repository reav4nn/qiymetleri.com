import { fetchStoreHealth } from "@/lib/admin-api";

export const dynamic = "force-dynamic";

export default async function StoresPage() {
  let stores;
  try {
    stores = await fetchStoreHealth();
  } catch {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>
          🏪 Mağazalar
        </h1>
        <div
          style={{
            padding: 24,
            backgroundColor: "var(--color-danger-subtle)",
            borderRadius: 12,
            color: "var(--color-danger)",
          }}
        >
          ⚠️ API-yə qoşulmaq mümkün olmadı.
        </div>
      </div>
    );
  }

  const totalProducts = stores.reduce((s, st) => s + st.product_count, 0);

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>
        🏪 Mağaza Sağlamlığı
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        {stores.map((store) => {
          const pct = totalProducts > 0
            ? Math.round((store.product_count / totalProducts) * 100)
            : 0;

          const crawlAge = store.last_crawl
            ? Math.floor(
                (Date.now() - new Date(store.last_crawl).getTime()) / 3600000
              )
            : null;

          const healthColor =
            crawlAge === null
              ? "var(--color-text-muted)"
              : crawlAge < 3
                ? "var(--color-success)"
                : crawlAge < 6
                  ? "#eab308"
                  : "var(--color-danger)";

          return (
            <div
              key={store.id}
              style={{
                backgroundColor: "var(--color-bg-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 12,
                padding: 20,
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>
                    {store.name}
                  </div>
                  <a
                    href={store.base_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 11,
                      color: "var(--color-accent)",
                      textDecoration: "none",
                    }}
                  >
                    {store.base_url.replace(/https?:\/\//, "")}
                  </a>
                </div>
                <span
                  style={{
                    padding: "3px 10px",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    backgroundColor: store.is_active
                      ? "var(--color-success-subtle)"
                      : "var(--color-danger-subtle)",
                    color: store.is_active
                      ? "var(--color-success)"
                      : "var(--color-danger)",
                  }}
                >
                  {store.is_active ? "Aktiv" : "Deaktiv"}
                </span>
              </div>

              {/* Stats */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px 16px",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--color-text-muted)",
                      marginBottom: 2,
                    }}
                  >
                    Məhsullar
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>
                    {store.product_count}{" "}
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--color-text-muted)",
                        fontWeight: 400,
                      }}
                    >
                      ({pct}%)
                    </span>
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--color-text-muted)",
                      marginBottom: 2,
                    }}
                  >
                    Stokda
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>
                    {store.in_stock_count}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--color-text-muted)",
                      marginBottom: 2,
                    }}
                  >
                    Ort. qiymət
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {store.avg_price ? `${store.avg_price.toFixed(0)} ₼` : "—"}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--color-text-muted)",
                      marginBottom: 2,
                    }}
                  >
                    Qiymət aralığı
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {store.min_price && store.max_price
                      ? `${store.min_price.toFixed(0)}–${store.max_price.toFixed(0)} ₼`
                      : "—"}
                  </div>
                </div>
              </div>

              {/* Last crawl */}
              <div
                style={{
                  marginTop: 16,
                  paddingTop: 12,
                  borderTop: "1px solid var(--color-border-subtle)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--color-text-muted)",
                  }}
                >
                  Son crawl
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: healthColor,
                  }}
                >
                  {store.last_crawl
                    ? crawlAge! < 1
                      ? "< 1 saat əvvəl"
                      : `${crawlAge} saat əvvəl`
                    : "Heç vaxt"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

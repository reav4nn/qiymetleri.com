import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Admin Panel | qiymetleri.com",
  robots: { index: false, follow: false },
};

const navItems = [
  { href: "/admin", label: "Dashboard", icon: "📊" },
  { href: "/admin/scraper", label: "Scraper", icon: "🕷️" },
  { href: "/admin/stores", label: "Mağazalar", icon: "🏪" },
  { href: "/admin/anomalies", label: "Anomaliyalar", icon: "⚠️" },
];

const adminCSS = `
  :root {
    --color-bg-page: #f5f5f7; --color-bg-surface: #ffffff; --color-bg-surface-hover: #f0f0f2;
    --color-bg-input: #f0f0f2; --color-border: #e0e0e5; --color-border-subtle: rgba(0,0,0,0.06);
    --color-text-primary: #1a1a2e; --color-text-secondary: #6b6b80; --color-text-muted: #9a9ab0;
    --color-accent: #6366f1; --color-accent-hover: #4f46e5; --color-accent-subtle: rgba(99,102,241,0.1);
    --color-success: #16a34a; --color-success-subtle: rgba(22,163,74,0.1);
    --color-danger: #dc2626; --color-danger-subtle: rgba(220,38,38,0.1);
  }
  [data-theme="dark"] {
    --color-bg-page: #0a0a0f; --color-bg-surface: #16161e; --color-bg-surface-hover: #1e1e2e;
    --color-bg-input: #1e1e2e; --color-border: #2a2a3e; --color-border-subtle: rgba(255,255,255,0.06);
    --color-text-primary: #f0f0f5; --color-text-secondary: #9a9ab0; --color-text-muted: #6a6a80;
    --color-accent: #6366f1; --color-accent-hover: #818cf8; --color-accent-subtle: rgba(99,102,241,0.15);
    --color-success: #22c55e; --color-success-subtle: rgba(34,197,94,0.15);
    --color-danger: #ef4444; --color-danger-subtle: rgba(239,68,68,0.15);
  }
  html[data-theme="dark"] { color-scheme: dark; }
  body { background-color: var(--color-bg-page); color: var(--color-text-primary); }
  .admin-nav-link { display:flex; align-items:center; gap:10px; padding:10px 16px; font-size:14px;
    color: var(--color-text-secondary); text-decoration:none; transition: background-color 0.2s; }
  .admin-nav-link:hover { background-color: var(--color-bg-surface-hover); }
`;

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="az" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
        <style dangerouslySetInnerHTML={{ __html: adminCSS }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}else{document.documentElement.setAttribute('data-theme','dark')}}catch(e){document.documentElement.setAttribute('data-theme','dark')}})();`,
          }}
        />
      </head>
      <body
        style={{
          margin: 0,
          fontFamily:
            '"SF Pro Rounded", ui-sans-serif, system-ui, -apple-system, sans-serif',
        }}
      >
        <div style={{ display: "flex", minHeight: "100vh" }}>
          <aside
            style={{
              width: 220,
              borderRight: "1px solid var(--color-border, #2a2a3e)",
              backgroundColor: "var(--color-bg-surface, #16161e)",
              padding: "20px 0",
              flexShrink: 0,
              position: "relative",
            }}
          >
            <div
              style={{
                padding: "0 16px 20px",
                borderBottom: "1px solid var(--color-border, #2a2a3e)",
                marginBottom: 8,
              }}
            >
              <Link
                href="/admin"
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "var(--color-accent, #6366f1)",
                  textDecoration: "none",
                }}
              >
                qiymetleri.com
              </Link>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--color-text-muted, #6a6a80)",
                  marginTop: 2,
                }}
              >
                Admin Panel
              </div>
            </div>
            <nav>
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className="admin-nav-link">
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
            <div
              style={{
                position: "absolute",
                bottom: 16,
                left: 16,
                fontSize: 11,
              }}
            >
              <Link
                href="/az"
                style={{
                  color: "var(--color-text-muted, #6a6a80)",
                  textDecoration: "none",
                }}
              >
                ← Sayta qayıt
              </Link>
            </div>
          </aside>

          <main style={{ flex: 1, padding: "24px 32px", overflow: "auto" }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

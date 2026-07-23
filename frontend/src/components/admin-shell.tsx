"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Boxes,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  ShieldCheck,
  Store,
  X,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-api";
import { ToastProvider } from "@/components/toast-context";

const nav = [
  ["", "İdarə paneli", LayoutDashboard],
  ["/scrapers", "Scraperlər", Activity],
  ["/products", "Məhsullar", Boxes],
  ["/stores", "Mağazalar", Store],
  ["/anomalies", "Anomaliyalar", AlertTriangle],
  ["/matches", "Uyğunlaşdırma", Network],
  ["/specs", "Spesifikasiya", ShieldCheck],
] as const;

export function AdminShell({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const base = `/${locale}/admin`;

  useEffect(() => {
    adminFetch("/auth/session")
      .then(() => setReady(true))
      .catch(() => router.replace(`${base}/login`));
  }, [base, router]);

  async function logout() {
    await adminFetch("/auth/logout", { method: "POST" });
    router.replace(`${base}/login`);
  }

  if (!ready)
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-100 text-sm text-zinc-500">
        Sessiya yoxlanılır…
      </div>
    );
  const sidebar = (
    <>
      <div className="flex h-20 items-center justify-between border-b border-white/10 px-5">
        <Link href={base} className="text-lg font-extrabold tracking-tight cursor-pointer hover:opacity-85 transition-opacity">
          qiymetleri<span className="text-red-500">.com</span>
        </Link>
        <button
          className="grid size-11 place-items-center rounded-xl transition-all hover:bg-white/10 active:scale-95 cursor-pointer lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Menyunu bağla"
        >
          <X />
        </button>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {nav.map(([href, label, Icon]) => {
          const target = `${base}${href}`;
          const active = href
            ? pathname.startsWith(target)
            : pathname === target;
          return (
            <Link
              key={href}
              href={target}
              onClick={() => setOpen(false)}
              className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-all duration-150 cursor-pointer active:scale-[0.98] ${
                active
                  ? "bg-red-600 text-white shadow-sm"
                  : "text-zinc-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon size={19} />
              {label}
            </Link>
          );
        })}
      </nav>
      <button
        onClick={logout}
        className="m-3 flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-zinc-400 transition-all duration-150 cursor-pointer hover:bg-white/10 hover:text-white active:scale-[0.98]"
      >
        <LogOut size={19} />
        Çıxış
      </button>
    </>
  );
  return (
    <ToastProvider>
      <div className="min-h-screen bg-zinc-100 text-zinc-950">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-zinc-950 text-white lg:flex">
          {sidebar}
        </aside>
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              className="absolute inset-0 bg-black/45 cursor-pointer"
              onClick={() => setOpen(false)}
              aria-label="Menyunu bağla"
            />
            <aside className="relative flex h-full w-[min(20rem,86vw)] flex-col bg-zinc-950 text-white">
              {sidebar}
            </aside>
          </div>
        )}
        <div className="lg:pl-64">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-white/90 px-4 backdrop-blur sm:px-6 lg:px-8">
            <button
              className="grid size-11 place-items-center rounded-xl border transition-all cursor-pointer hover:bg-zinc-100 active:scale-95 lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Menyunu aç"
            >
              <Menu />
            </button>
            <div>
              <p className="text-sm font-bold">İdarəetmə paneli</p>
              <p className="text-xs text-zinc-500">
                Scraper və kataloq əməliyyatları
              </p>
            </div>
          </header>
          <main className="p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}

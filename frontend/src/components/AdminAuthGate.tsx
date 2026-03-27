"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Client-side auth gate for admin pages.
 * Prompts for credentials and verifies against the admin API before rendering children.
 */
export function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "prompt" | "authenticated" | "failed">("loading");

  const verify = useCallback(async (token: string) => {
    try {
      const res = await fetch("/api/v1/admin/dashboard", {
        cache: "no-store",
        headers: { Authorization: `Basic ${token}` },
      });
      if (res.ok) {
        sessionStorage.setItem("admin_auth", token);
        setState("authenticated");
        return true;
      }
    } catch {
      // network error
    }
    sessionStorage.removeItem("admin_auth");
    return false;
  }, []);

  useEffect(() => {
    const existing = sessionStorage.getItem("admin_auth");
    if (existing) {
      verify(existing).then((ok) => {
        if (!ok) setState("prompt");
      });
    } else {
      setState("prompt");
    }
  }, [verify]);

  const handleLogin = async () => {
    const user = window.prompt("Admin username:");
    if (!user) return;
    const pass = window.prompt("Admin password:");
    if (!pass) return;
    const token = btoa(`${user}:${pass}`);
    const ok = await verify(token);
    if (!ok) setState("failed");
  };

  if (state === "authenticated") return <>{children}</>;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "var(--color-bg-page)",
        color: "var(--color-text-primary)",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 360 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Admin Panel</h1>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: 24 }}>
          {state === "failed"
            ? "Yanlış istifadəçi adı və ya şifrə."
            : "Bu səhifəyə daxil olmaq üçün avtorizasiya tələb olunur."}
        </p>
        <button
          onClick={handleLogin}
          style={{
            padding: "10px 32px",
            fontSize: 14,
            fontWeight: 600,
            color: "#fff",
            background: "var(--color-accent, #6366f1)",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Daxil ol
        </button>
      </div>
    </div>
  );
}

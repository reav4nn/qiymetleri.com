"use client";

import { FormEvent, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { adminFetch } from "@/lib/admin-api";

export default function AdminLoginPage() {
  const { locale } = useParams<{ locale: string }>();
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const data = new FormData(event.currentTarget);
    try {
      await adminFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: data.get("username"),
          password: data.get("password"),
        }),
      });
      router.replace(`/${locale}/admin`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Giriş alınmadı");
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="grid min-h-screen place-items-center bg-zinc-950 px-4 py-10">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-9"
      >
        <div className="mb-8 grid size-14 place-items-center rounded-2xl bg-red-50 text-red-600">
          <LockKeyhole />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">Admin girişi</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Scraper və məhsul məlumatlarını təhlükəsiz idarə edin.
        </p>
        <label className="mt-7 block text-sm font-bold">
          İstifadəçi adı
          <input
            name="username"
            required
            autoComplete="username"
            className="mt-2 h-12 w-full rounded-xl border px-4 font-normal outline-none focus:border-red-500"
          />
        </label>
        <label className="mt-4 block text-sm font-bold">
          Şifrə
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-2 h-12 w-full rounded-xl border px-4 font-normal outline-none focus:border-red-500"
          />
        </label>
        {error && (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
        <button
          disabled={loading}
          className="mt-6 min-h-12 w-full rounded-xl bg-red-600 px-5 font-bold text-white transition-all cursor-pointer hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Yoxlanılır…" : "Daxil ol"}
        </button>
      </form>
    </main>
  );
}

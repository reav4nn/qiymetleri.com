"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-api";

type Stats = {
  total_products: number;
  total_stores: number;
  active_stores: number;
  total_prices: number;
  products_with_images: number;
  last_price_update?: string;
  categories: { name: string; count: number }[];
};
export default function DashboardPage() {
  const [data, setData] = useState<Stats | null>(null);
  useEffect(() => {
    adminFetch<Stats>("/dashboard").then(setData);
  }, []);
  const cards = [
    ["Məhsullar", data?.total_products],
    [
      "Aktiv mağazalar",
      `${data?.active_stores ?? 0} / ${data?.total_stores ?? 0}`,
    ],
    ["Cari qiymətlər", data?.total_prices],
    ["Şəkilli məhsullar", data?.products_with_images],
  ];
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold sm:text-3xl">Ümumi vəziyyət</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Kataloq və sistem göstəricilərinin canlı xülasəsi
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <section
            key={label as string}
            className="rounded-2xl border bg-white p-5"
          >
            <p className="text-sm font-semibold text-zinc-500">{label}</p>
            <p className="mt-3 text-3xl font-extrabold">{value ?? "—"}</p>
          </section>
        ))}
      </div>
      <section className="mt-6 rounded-2xl border bg-white p-5 sm:p-6">
        <h2 className="text-lg font-bold">Kateqoriyalar</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {data?.categories.map((c) => (
            <div
              key={c.name}
              className="flex items-center justify-between rounded-xl bg-zinc-50 p-4"
            >
              <span className="capitalize">{c.name}</span>
              <b>{c.count}</b>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

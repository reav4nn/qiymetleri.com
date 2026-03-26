"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslations, useLocale } from "next-intl";
import type { PriceHistory } from "@/lib/api";

const STORE_NAMES: Record<string, string> = {
  kontakt_home: "Kontakt Home",
  baku_electronics: "Baku Electronics",
  irshad_electronics: "Irshad Electronics",
  ispace: "iSpace",
};

const STORE_COLORS: Record<string, string> = {
  kontakt_home: "#2563eb",
  baku_electronics: "#dc2626",
  irshad_electronics: "#16a34a",
  ispace: "#9333ea",
};

interface PriceHistoryChartProps {
  data: PriceHistory[];
}

export function PriceHistoryChart({ data }: PriceHistoryChartProps) {
  const t = useTranslations("product");
  const locale = useLocale();

  if (!data.length) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-text-muted)]">
        {t("priceHistoryEmpty")}
      </div>
    );
  }

  // Group by date, pivot stores into columns
  const storeIds = [...new Set(data.map((d) => d.store_id))];
  const grouped = new Map<string, Record<string, number | string>>();

  for (const entry of data) {
    const dateKey = new Date(entry.time).toLocaleDateString(locale === "ru" ? "ru-RU" : "az-AZ", {
      day: "2-digit",
      month: "2-digit",
    });
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, { date: dateKey });
    }
    grouped.get(dateKey)![entry.store_id] = entry.price_azn;
  }

  const chartData = Array.from(grouped.values());

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
        <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#9a9ab0" }} stroke="#2a2a3e" />
        <YAxis
          tick={{ fontSize: 12, fill: "#9a9ab0" }}
          tickFormatter={(v: number) => `${v} ₼`}
          stroke="#2a2a3e"
        />
        <Tooltip
          contentStyle={{ backgroundColor: "#16161e", border: "1px solid #2a2a3e", borderRadius: "8px", color: "#f0f0f5" }}
          formatter={(value, name) => [
            `${Number(value).toFixed(2)} ₼`,
            STORE_NAMES[String(name)] || String(name),
          ]}
        />
        <Legend
          formatter={(value: string) => STORE_NAMES[value] || value}
          wrapperStyle={{ color: "#9a9ab0" }}
        />
        {storeIds.map((storeId) => (
          <Line
            key={storeId}
            type="monotone"
            dataKey={storeId}
            stroke={STORE_COLORS[storeId] || "#6b7280"}
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

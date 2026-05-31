"use client";

import { useEffect, useState } from "react";
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
  kontakt_home: "#737373",
  baku_electronics: "#525252",
  irshad_electronics: "#404040",
  ispace: "#262626",
};

interface PriceHistoryChartProps {
  data: PriceHistory[];
}

export function PriceHistoryChart({ data }: PriceHistoryChartProps) {
  const t = useTranslations("product");
  const locale = useLocale();

  const [isDark, setIsDark] = useState(true);
  const [chartHeight, setChartHeight] = useState(300);

  useEffect(() => {
    const check = () => {
      setIsDark(document.documentElement.getAttribute("data-theme") === "dark");
    };
    check();
    const updateHeight = () => {
      setChartHeight(window.innerWidth < 640 ? 220 : 300);
    };
    updateHeight();
    window.addEventListener("resize", updateHeight);
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  const gridStroke = isDark ? "#1f1f1f" : "#e5e5e5";
  const tickFill = isDark ? "#a3a3a3" : "#737373";
  const tooltipBg = isDark ? "#111111" : "#ffffff";
  const tooltipBorder = isDark ? "#1f1f1f" : "#e5e5e5";
  const tooltipColor = isDark ? "#fafafa" : "#0a0a0a";
  const legendColor = isDark ? "#a3a3a3" : "#737373";

  if (!data.length) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-[var(--color-text-muted)]">
        {t("priceHistoryEmpty")}
      </div>
    );
  }

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
    <ResponsiveContainer width="100%" height={chartHeight}>
      <LineChart data={chartData} margin={{ left: -10, right: 5, top: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
        <XAxis dataKey="date" tick={{ fontSize: 12, fill: tickFill }} stroke={gridStroke} />
        <YAxis
          tick={{ fontSize: 12, fill: tickFill }}
          tickFormatter={(v: number) => `${v} ₼`}
          stroke={gridStroke}
        />
        <Tooltip
          contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: "8px", color: tooltipColor }}
          formatter={(value, name) => [
            `${Number(value).toFixed(2)} ₼`,
            STORE_NAMES[String(name)] || String(name),
          ]}
        />
        <Legend
          formatter={(value: string) => STORE_NAMES[value] || value}
          wrapperStyle={{ color: legendColor }}
        />
        {storeIds.map((storeId) => (
          <Line
            key={storeId}
            type="monotone"
            dataKey={storeId}
            stroke={STORE_COLORS[storeId] || (isDark ? "#a3a3a3" : "#737373")}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

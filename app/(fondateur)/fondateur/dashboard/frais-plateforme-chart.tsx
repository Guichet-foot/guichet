"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";

interface FraisPlateformeChartProps {
  data: { date: string; label: string; revenue: number }[];
}

function formatAmount(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return String(value);
}

function formatFCFA(value: number) {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FCFA";
}

export function FraisPlateformeChart({ data }: FraisPlateformeChartProps) {
  const hasData = data.some((d) => d.revenue > 0);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">
        Aucune recette sur cette période
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} barGap={2} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E2DD" />
        <XAxis
          dataKey="label"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          interval={data.length > 20 ? Math.floor(data.length / 15) : 0}
          tick={{ fill: "#6B7280" }}
        />
        <YAxis
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatAmount}
          tick={{ fill: "#6B7280" }}
          width={48}
        />
        <Tooltip
          cursor={{ fill: "#F3F4F6" }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="bg-white border border-border rounded-lg shadow-md p-3 text-xs">
                <p className="font-semibold text-foreground mb-1">{label}</p>
                <p className="text-amber-700 font-bold">{formatFCFA(payload[0].value as number)}</p>
              </div>
            );
          }}
        />
        <Bar dataKey="revenue" name="Frais plateforme" radius={[4, 4, 0, 0]} barSize={18}>
          {data.map((entry, index) => (
            <Cell
              key={index}
              fill={entry.revenue > 0 ? "#D97706" : "#E5E7EB"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

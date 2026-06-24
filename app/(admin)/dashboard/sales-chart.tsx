"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface SalesChartProps {
  data: { date: string; ventes: number }[];
}

function formatTooltipValue(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value) + " FCFA";
}

export function SalesChart({ data }: SalesChartProps) {
  if (data.every((d) => d.ventes === 0)) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground">
        Aucune vente sur cette période
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" fontSize={12} />
        <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
        <Tooltip
          formatter={(value) => [formatTooltipValue(Number(value)), "Ventes"]}
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid #E5E2DD",
          }}
        />
        <Bar dataKey="ventes" fill="#0D5C3F" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

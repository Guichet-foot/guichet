"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface RevenueLineChartProps {
  data: { month: string; revenue: number }[];
}

function formatAmount(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return String(value);
}

export function RevenueLineChart({ data }: RevenueLineChartProps) {
  if (data.every((d) => d.revenue === 0)) {
    return (
      <div className="h-[250px] flex items-center justify-center text-muted-foreground">
        Aucun revenu sur cette période
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#E8A53D" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#E8A53D" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E2DD" />
        <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={formatAmount} />
        <Tooltip
          formatter={(value) => [String(value || 0).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FCFA", "Revenus"]}
          contentStyle={{ borderRadius: "8px", border: "1px solid #E5E2DD", fontSize: "12px" }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#E8A53D"
          strokeWidth={2.5}
          fill="url(#revenueGradient)"
          dot={{ r: 4, fill: "#E8A53D", stroke: "#fff", strokeWidth: 2 }}
          activeDot={{ r: 6, fill: "#E8A53D", stroke: "#fff", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

interface RecettesDepensesChartProps {
  data: { month: string; recettes: number; depenses: number }[];
  year: number;
}

function formatAmount(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return String(value);
}

export function RecettesDepensesChart({ data, year }: RecettesDepensesChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E2DD" />
        <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={formatAmount} />
        <Tooltip
          formatter={(value) => [String(value || 0).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FCFA"]}
          contentStyle={{ borderRadius: "8px", border: "1px solid #E5E2DD", fontSize: "12px" }}
        />
        <Legend
          iconType="square"
          wrapperStyle={{ fontSize: "13px", paddingTop: "10px" }}
        />
        <Bar dataKey="recettes" name="Recettes" fill="#16A571" radius={[4, 4, 0, 0]} barSize={20} />
        <Bar dataKey="depenses" name="Dépenses" fill="#DC2626" radius={[4, 4, 0, 0]} barSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}

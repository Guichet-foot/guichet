"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

export interface ChartPoint {
  date: string;
  printed: number;
  unsold: number;
  revenue: number;
}

function fmtRevenue(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return `${v}`;
}

function fmtTooltipRevenue(v: number) {
  return new Intl.NumberFormat("fr-FR").format(v) + " FCFA";
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white border border-border rounded-xl shadow-lg p-3 text-xs space-y-1.5">
      <p className="font-semibold text-ink">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium" style={{ color: p.color }}>
            {p.dataKey === "revenue" ? fmtTooltipRevenue(p.value) : p.value.toLocaleString("fr-FR")}
          </span>
        </div>
      ))}
    </div>
  );
};

export function GlobalStatsChart({ data }: { data: ChartPoint[] }) {
  const isEmpty = data.every((d) => d.printed === 0 && d.revenue === 0);

  if (isEmpty) {
    return (
      <div className="h-[280px] flex flex-col items-center justify-center text-muted-foreground gap-2">
        <svg className="h-10 w-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="text-sm">Aucune donnée sur cette période</p>
      </div>
    );
  }

  // On mobile show fewer labels
  const totalPoints = data.length;
  const tickInterval = totalPoints > 14 ? Math.floor(totalPoints / 7) : 0;

  return (
    <div className="h-[240px] sm:h-[280px] lg:h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE8" vertical={false} />
          <XAxis
            dataKey="date"
            fontSize={11}
            tick={{ fill: "#9B9590" }}
            tickLine={false}
            axisLine={false}
            interval={tickInterval}
          />
          <YAxis
            yAxisId="left"
            fontSize={11}
            tick={{ fill: "#9B9590" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => v.toLocaleString("fr-FR")}
            width={40}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            fontSize={11}
            tick={{ fill: "#9B9590" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={fmtRevenue}
            width={44}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
            formatter={(value) => <span className="text-ink">{value}</span>}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="printed"
            name="Billets imprimés"
            stroke="#16A571"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="unsold"
            name="Billets invendus"
            stroke="#EF4444"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="revenue"
            name="Recettes (FCFA)"
            stroke="#3B82F6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

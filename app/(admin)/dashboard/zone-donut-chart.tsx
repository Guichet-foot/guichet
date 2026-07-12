"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useState } from "react";

export interface ZoneRevenue {
  id: string;
  name: string;
  revenue: number;
  pct: number;
}

interface ZoneDonutChartProps {
  zones: ZoneRevenue[];
  total: number;
}

const ZONE_COLORS = ["#0D5C3F", "#2563EB", "#7C3AED", "#D97706", "#6B7280", "#EC4899", "#14B8A6"];

function fmt(v: number) {
  return new Intl.NumberFormat("fr-FR").format(v);
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0];
  return (
    <div className="bg-white border border-border rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-ink">{d.name}</p>
      <p className="text-muted-foreground mt-0.5">{fmt(d.value)} FCFA</p>
      <p className="text-brand font-medium">{d.payload.pct.toFixed(1)}%</p>
    </div>
  );
};

export function ZoneDonutChart({ zones, total }: ZoneDonutChartProps) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  if (zones.length === 0 || total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
        <svg className="h-10 w-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        </svg>
        <p className="text-sm">Aucune recette sur cette période</p>
      </div>
    );
  }

  const chartData = zones.map((z) => ({ name: z.name, value: z.revenue, pct: z.pct }));

  return (
    <div className="flex flex-col lg:flex-row items-center gap-4 lg:gap-6">
      {/* Donut */}
      <div className="relative w-48 h-48 sm:w-56 sm:h-56 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius="52%"
              outerRadius="80%"
              paddingAngle={2}
              dataKey="value"
              stroke="none"
              onMouseEnter={(_, idx) => setActiveIdx(idx)}
              onMouseLeave={() => setActiveIdx(null)}
            >
              {chartData.map((_, i) => (
                <Cell
                  key={i}
                  fill={ZONE_COLORS[i % ZONE_COLORS.length]}
                  opacity={activeIdx === null || activeIdx === i ? 1 : 0.55}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-xs text-muted-foreground font-medium">Total</p>
          <p className="text-lg font-bold text-ink tabular-nums leading-tight">{fmt(total)}</p>
          <p className="text-xs text-muted-foreground">FCFA</p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex-1 w-full space-y-2 overflow-hidden">
        {zones.map((z, i) => (
          <div
            key={z.id}
            className="flex items-center gap-2 py-1.5 border-b border-border/40 last:border-0"
            onMouseEnter={() => setActiveIdx(i)}
            onMouseLeave={() => setActiveIdx(null)}
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: ZONE_COLORS[i % ZONE_COLORS.length] }}
            />
            <p className="flex-1 text-xs sm:text-sm font-medium text-ink truncate">{z.name}</p>
            <p className="text-xs sm:text-sm font-bold tabular-nums text-brand shrink-0">
              {fmt(z.revenue)} FCFA
            </p>
            <p className="text-xs text-muted-foreground shrink-0 w-10 text-right">{z.pct.toFixed(1)}%</p>
          </div>
        ))}
      </div>
    </div>
  );
}

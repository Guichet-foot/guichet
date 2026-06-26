"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, Wallet } from "lucide-react";

interface MatchRevenue {
  id: string;
  teams: string;
  date: string;
  revenue: number;
}

interface RevenueDonutProps {
  matches: MatchRevenue[];
}

const COLORS = ["#0D5C3F", "#16A571", "#E8A53D", "#4F46E5", "#6366F1"];

function formatAmount(amount: number) {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FCFA";
}

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export function RevenueDonut({ matches }: RevenueDonutProps) {
  const totalRevenue = matches.reduce((sum, m) => sum + m.revenue, 0);

  if (totalRevenue === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Aucune recette sur les derniers matchs</p>
      </div>
    );
  }

  const avgPerMatch = matches.length > 0 ? Math.round(totalRevenue / matches.length) : 0;
  const bestMatch = matches.reduce((best, m) => (m.revenue > best.revenue ? m : best), matches[0]);

  const chartData = matches.map((m) => ({
    name: m.teams,
    value: m.revenue,
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* LEFT: Donut chart */}
        <div className="flex items-center justify-center">
          <div className="relative w-56 h-56 sm:w-64 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius="55%"
                  outerRadius="85%"
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                  label={({ percent }: { percent?: number }) => `${((percent || 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {chartData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-xs text-muted-foreground">Total recettes</p>
              <p className="text-xl sm:text-2xl font-bold text-ink">{formatAmount(totalRevenue).replace(" FCFA", "")}</p>
              <p className="text-xs text-muted-foreground">FCFA</p>
            </div>
          </div>
        </div>

        {/* RIGHT: Detail list */}
        <div>
          <p className="text-xs font-bold uppercase text-muted-foreground mb-3">Détail par match</p>
          <div className="space-y-3">
            {matches.map((m, i) => {
              const pct = totalRevenue > 0 ? Math.round((m.revenue / totalRevenue) * 100) : 0;
              return (
                <div key={m.id} className="flex items-start gap-3">
                  <div
                    className="w-3 h-3 rounded-sm shrink-0 mt-1"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{m.teams}</p>
                    <p className="text-xs text-muted-foreground">{formatShortDate(m.date)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-sm text-brand">{formatAmount(m.revenue)}</p>
                    <p className="text-xs text-muted-foreground">{pct}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-muted/50 rounded-lg p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
            <TrendingUp className="h-5 w-5 text-brand" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Moyenne par match</p>
            <p className="font-bold text-brand">{formatAmount(avgPerMatch)}</p>
          </div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
            <Wallet className="h-5 w-5 text-brand" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Meilleure recette</p>
            <p className="font-bold text-brand">{formatAmount(bestMatch.revenue)}</p>
            <p className="text-xs text-muted-foreground truncate max-w-[150px]">{bestMatch.teams}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

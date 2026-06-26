"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
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
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export function RevenueDonut({ matches }: RevenueDonutProps) {
  const totalRevenue = matches.reduce((sum, m) => sum + m.revenue, 0);

  if (totalRevenue === 0 && matches.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Aucune recette sur les derniers matchs</p>
      </div>
    );
  }

  const avgPerMatch = matches.length > 0 ? Math.round(totalRevenue / matches.length) : 0;
  const bestMatch = matches.reduce((best, m) => (m.revenue > best.revenue ? m : best), matches[0]);

  const chartData = matches
    .filter((m) => m.revenue > 0)
    .map((m) => ({
      name: m.teams,
      value: m.revenue,
    }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* LEFT: Donut chart */}
        <div className="flex items-center justify-center">
          <div className="relative w-64 h-64 sm:w-72 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData.length > 0 ? chartData : [{ name: "Aucune", value: 1 }]}
                  cx="50%"
                  cy="50%"
                  innerRadius="50%"
                  outerRadius="80%"
                  paddingAngle={chartData.length > 1 ? 3 : 0}
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.length > 0 ? (
                    chartData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))
                  ) : (
                    <Cell fill="#E5E2DD" />
                  )}
                </Pie>
                <Tooltip
                  formatter={(value) => [formatAmount(Number(value)), "Recettes"]}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #E5E2DD", fontSize: "12px" }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-xs text-muted-foreground">Total recettes</p>
              <p className="text-2xl sm:text-3xl font-bold text-ink">
                {totalRevenue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")}
              </p>
              <p className="text-sm text-muted-foreground">FCFA</p>
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
                <div key={m.id} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                  <div
                    className="w-3 h-3 rounded-full shrink-0 mt-1.5"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{m.teams}</p>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-muted/50 rounded-lg p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
            <TrendingUp className="h-5 w-5 text-brand" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Moyenne par match</p>
            <p className="font-bold text-brand text-lg">{formatAmount(avgPerMatch)}</p>
          </div>
        </div>
        <div className="bg-muted/50 rounded-lg p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
            <Wallet className="h-5 w-5 text-brand" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Meilleure recette</p>
            <p className="font-bold text-brand text-lg">{formatAmount(bestMatch.revenue)}</p>
            <p className="text-xs text-muted-foreground">{bestMatch.teams}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

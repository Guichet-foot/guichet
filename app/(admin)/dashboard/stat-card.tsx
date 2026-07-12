import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  iconBg?: string;
  trend?: number;
}

export function StatCard({ title, value, subtitle, icon, iconBg = "bg-brand/10", trend }: StatCardProps) {
  const isPositive = trend !== undefined && trend > 0;
  const isNegative = trend !== undefined && trend < 0;

  return (
    <Card className="rounded-2xl shadow-sm border-border/40 hover:shadow-md transition-shadow">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm text-muted-foreground font-medium leading-tight">{title}</p>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-ink mt-1 tabular-nums leading-none">
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1.5 leading-tight">{subtitle}</p>
            )}
            {trend !== undefined && (
              <div
                className={`flex items-center gap-1 mt-2 text-xs font-semibold ${
                  isPositive ? "text-green-600" : isNegative ? "text-red-500" : "text-muted-foreground"
                }`}
              >
                {isPositive && <TrendingUp className="h-3 w-3 shrink-0" />}
                {isNegative && <TrendingDown className="h-3 w-3 shrink-0" />}
                <span>
                  {trend > 0 ? "+" : ""}
                  {Math.abs(trend).toFixed(1)}% vs période précédente
                </span>
              </div>
            )}
          </div>
          <div
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

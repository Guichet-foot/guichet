import { ReactNode } from "react";
import { formatFCFA } from "@/lib/format";

interface IndicatorProps {
  icon: ReactNode;
  value: string | number;
  title: string;
  subtitle: string;
  iconBg?: string;
}

function Indicator({ icon, value, title, subtitle, iconBg = "bg-brand/10" }: IndicatorProps) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-base sm:text-xl font-bold text-ink tabular-nums leading-tight truncate">{value}</p>
        <p className="text-xs font-medium text-ink leading-tight">{title}</p>
        <p className="text-xs text-muted-foreground leading-tight">{subtitle}</p>
      </div>
    </div>
  );
}

export interface SecondaryData {
  matchesPlayed: number;
  teamsActive: number;
  ticketsSold: number;
  unsoldRate: number;
  totalRevenue: number;
}

export function SecondaryIndicators({ data }: { data: SecondaryData }) {
  const indicators: IndicatorProps[] = [
    {
      icon: (
        <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      value: data.matchesPlayed,
      title: "Matchs joués",
      subtitle: "Ce mois",
      iconBg: "bg-brand/10",
    },
    {
      icon: (
        <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      value: data.teamsActive,
      title: "Équipes actives",
      subtitle: "Toutes zones",
      iconBg: "bg-blue-50",
    },
    {
      icon: (
        <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
        </svg>
      ),
      value: data.ticketsSold.toLocaleString("fr-FR"),
      title: "Billets vendus",
      subtitle: "Ce mois",
      iconBg: "bg-green-50",
    },
    {
      icon: (
        <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      value: `${data.unsoldRate.toFixed(1)}%`,
      title: "Taux d'invendus",
      subtitle: "Moyenne",
      iconBg: "bg-orange-50",
    },
    {
      icon: (
        <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      value: formatFCFA(data.totalRevenue),
      title: "Recettes totales",
      subtitle: "Ce mois",
      iconBg: "bg-emerald-50",
    },
  ];

  return (
    <div className="grid grid-cols-1 min-[480px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
      {indicators.map((ind, i) => (
        <Indicator key={i} {...ind} />
      ))}
    </div>
  );
}

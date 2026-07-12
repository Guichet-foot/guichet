import Link from "next/link";
import { formatFCFA, formatDateShort } from "@/lib/format";

export interface RecentMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  zoneName: string;
  matchDate: string;
  printed: number;
  unsold: number;
  revenue: number;
}

export function RecentMatchesList({ matches }: { matches: RecentMatch[] }) {
  if (matches.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground text-sm">
        Aucun match récent
      </div>
    );
  }

  return (
    <>
      {/* Desktop/Tablet table */}
      <div className="hidden sm:block overflow-x-auto -mx-1">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-border/60">
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Match</th>
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Zone</th>
              <th className="text-right py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Imprimés</th>
              <th className="text-right py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Invendus</th>
              <th className="text-right py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recettes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {matches.map((m) => (
              <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                      <svg className="w-3 h-3 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-ink text-xs leading-tight truncate">
                        {m.homeTeam} <span className="text-muted-foreground font-normal">vs</span> {m.awayTeam}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDateShort(m.matchDate)}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-3">
                  <span className="inline-block bg-brand/10 text-brand text-xs font-medium px-2 py-0.5 rounded-full">
                    {m.zoneName}
                  </span>
                </td>
                <td className="py-3 px-3 text-right tabular-nums text-sm">{m.printed.toLocaleString("fr-FR")}</td>
                <td className="py-3 px-3 text-right tabular-nums text-sm text-orange-600">{m.unsold.toLocaleString("fr-FR")}</td>
                <td className="py-3 px-3 text-right tabular-nums text-sm font-semibold text-brand">
                  {formatFCFA(m.revenue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {matches.map((m) => (
          <div key={m.id} className="rounded-xl border border-border/50 p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-sm text-ink leading-snug">
                  {m.homeTeam} <span className="text-muted-foreground font-normal text-xs">vs</span> {m.awayTeam}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{formatDateShort(m.matchDate)}</p>
              </div>
              <span className="inline-block bg-brand/10 text-brand text-xs font-medium px-2 py-0.5 rounded-full shrink-0">
                {m.zoneName}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/40">
              <div>
                <p className="text-xs text-muted-foreground">Imprimés</p>
                <p className="font-semibold text-sm tabular-nums">{m.printed.toLocaleString("fr-FR")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Invendus</p>
                <p className="font-semibold text-sm tabular-nums text-orange-600">{m.unsold.toLocaleString("fr-FR")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Recettes</p>
                <p className="font-semibold text-xs tabular-nums text-brand">{formatFCFA(m.revenue)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

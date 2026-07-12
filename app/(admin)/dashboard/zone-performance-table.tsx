import { formatFCFA } from "@/lib/format";

export interface ZoneStat {
  id: string;
  name: string;
  printed: number;
  sold: number;
  unsold: number;
  revenue: number;
  matchCount: number;
  unsoldRate: number;
}

function UnsoldBadge({ rate }: { rate: number }) {
  const cls =
    rate < 10 ? "text-green-700 bg-green-50" :
    rate < 20 ? "text-orange-700 bg-orange-50" :
                "text-red-700 bg-red-50";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {rate.toFixed(1)}%
    </span>
  );
}

interface ZonePerformanceTableProps {
  zones: ZoneStat[];
}

export function ZonePerformanceTable({ zones }: ZonePerformanceTableProps) {
  const total = zones.reduce(
    (acc, z) => ({
      printed: acc.printed + z.printed,
      sold: acc.sold + z.sold,
      unsold: acc.unsold + z.unsold,
      revenue: acc.revenue + z.revenue,
      matchCount: acc.matchCount + z.matchCount,
    }),
    { printed: 0, sold: 0, unsold: 0, revenue: 0, matchCount: 0 }
  );
  const totalUnsoldRate = total.printed > 0 ? (total.unsold / total.printed) * 100 : 0;

  if (zones.length === 0) {
    return (
      <div className="py-10 text-center text-muted-foreground text-sm">
        Aucune donnée disponible
      </div>
    );
  }

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-border/60">
            <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Zone</th>
            <th className="text-right py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Imprimés</th>
            <th className="text-right py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Invendus</th>
            <th className="text-right py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Taux</th>
            <th className="text-right py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recettes</th>
            <th className="text-right py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Matchs</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {zones.map((z) => (
            <tr key={z.id} className="hover:bg-muted/30 transition-colors">
              <td className="py-2.5 px-3 font-medium text-ink">{z.name}</td>
              <td className="py-2.5 px-3 text-right tabular-nums">{z.printed.toLocaleString("fr-FR")}</td>
              <td className="py-2.5 px-3 text-right tabular-nums text-orange-600">{z.unsold.toLocaleString("fr-FR")}</td>
              <td className="py-2.5 px-3 text-right">
                <UnsoldBadge rate={z.unsoldRate} />
              </td>
              <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-brand">
                {formatFCFA(z.revenue)}
              </td>
              <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">{z.matchCount}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-muted/40 border-t-2 border-border font-bold">
            <td className="py-2.5 px-3 text-ink">Total général</td>
            <td className="py-2.5 px-3 text-right tabular-nums">{total.printed.toLocaleString("fr-FR")}</td>
            <td className="py-2.5 px-3 text-right tabular-nums text-orange-600">{total.unsold.toLocaleString("fr-FR")}</td>
            <td className="py-2.5 px-3 text-right">
              <UnsoldBadge rate={totalUnsoldRate} />
            </td>
            <td className="py-2.5 px-3 text-right tabular-nums text-brand">{formatFCFA(total.revenue)}</td>
            <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">{total.matchCount}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

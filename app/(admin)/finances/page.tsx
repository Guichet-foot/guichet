import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getEffectiveZone } from "@/lib/get-effective-zone";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Banknote, TrendingDown, TrendingUp, Landmark, PackageX, Layers, ScanLine, ReceiptText } from "lucide-react";
import { formatFCFA, formatDate } from "@/lib/format";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/constants";
import { buildZoneUrl } from "@/lib/zone-utils";
import { ZoneCardGrid } from "@/components/zone-card-grid";
import { ZoneBackHeader } from "@/components/zone-back-header";
import { FinancesFilters } from "./finances-filters";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Finances" };

/* eslint-disable @typescript-eslint/no-explicit-any */

type Period = "24h" | "jour" | "mois" | "custom";

export default async function FinancesPage({
  searchParams,
}: {
  searchParams: Promise<{ zone?: string; period?: string; date?: string; from?: string; to?: string; match?: string }>;
}) {
  const profile = await requireRole(["super_admin", "admin_zone", "c3"]);
  const params = await searchParams;
  const { effectiveZoneId, selectedZone, ownedZones, needsZoneSelection, c3AccountId } =
    await getEffectiveZone(profile, params.zone);

  if (needsZoneSelection) {
    return <ZoneCardGrid zones={ownedZones} title="Finances" />;
  }

  const supabase = await createClient();
  const adminSupabase = await createAdminClient();
  const zoneId = effectiveZoneId;

  const today = new Date().toISOString().split("T")[0];
  const period = (params.period as Period) || "24h";
  const filterMatchId = params.match || null;

  // ── Date range from period params ────────────────────────────────
  let dateStart: Date;
  let dateEnd: Date;
  let periodLabel: string;
  let settingsDate = today;

  if (period === "24h") {
    dateEnd = new Date();
    dateStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
    periodLabel = "Dernières 24h";
    settingsDate = today;
  } else if (period === "jour") {
    const d = params.date || today;
    dateStart = new Date(d + "T00:00:00");
    dateEnd = new Date(d + "T23:59:59.999");
    periodLabel = d === today ? "Aujourd'hui" : `Le ${formatDate(d)}`;
    settingsDate = d;
  } else if (period === "custom" && params.from && params.to) {
    dateStart = new Date(params.from + "T00:00:00");
    dateEnd = new Date(params.to + "T23:59:59.999");
    periodLabel = `Du ${formatDate(params.from)} au ${formatDate(params.to)}`;
    settingsDate = params.to;
  } else {
    // Mois en cours
    dateStart = new Date();
    dateStart.setDate(1);
    dateStart.setHours(0, 0, 0, 0);
    dateEnd = new Date();
    dateEnd.setHours(23, 59, 59, 999);
    periodLabel = "Mois en cours";
  }

  if (filterMatchId) periodLabel = "Match sélectionné";

  // ── Platform settings ────────────────────────────────────────────
  const { data: platformData } = await adminSupabase
    .from("platform_settings")
    .select("odcav_rate")
    .lte("effective_date", settingsDate)
    .order("effective_date", { ascending: false })
    .limit(1)
    .single();
  const odcavRate = platformData?.odcav_rate ?? 0.05;

  // ── Matches in period (zone-scoped) — source of truth for period filter ──
  let matchesPeriodQuery = adminSupabase
    .from("matches")
    .select("id, home_team, away_team, match_date");

  if (filterMatchId) {
    matchesPeriodQuery = matchesPeriodQuery.eq("id", filterMatchId);
  } else {
    matchesPeriodQuery = matchesPeriodQuery
      .gte("match_date", dateStart.toISOString())
      .lte("match_date", dateEnd.toISOString());
  }
  if (c3AccountId) matchesPeriodQuery = (matchesPeriodQuery as any).eq("c3_account_id", c3AccountId);
  else if (zoneId) matchesPeriodQuery = matchesPeriodQuery.eq("zone_id", zoneId);

  const { data: matchesInPeriod } = await matchesPeriodQuery;
  const matchIdsInPeriod = (matchesInPeriod || []).map((m: any) => m.id as string);

  // ── Tickets for those matches ────────────────────────────────────
  let periodTickets: any[] = [];
  if (matchIdsInPeriod.length > 0) {
    const { data } = await adminSupabase
      .from("tickets")
      .select("price, status, bloc_printed, counts_as_revenue, match_id")
      .in("match_id", matchIdsInPeriod);
    periodTickets = data || [];
  }

  // ── Financial metrics (new model: ODCAV prints blocs → zones scan) ──
  const printedTickets = periodTickets.filter((t: any) => t.bloc_printed === true);
  const totalPrinted = printedTickets.length;
  const totalBlocs = totalPrinted > 0 ? Math.ceil(totalPrinted / 100) : 0;
  const totalScanned = periodTickets.filter((t: any) => t.status === "scanne").length;
  const totalUnsold = Math.max(0, totalPrinted - totalScanned);
  const totalUnsoldValue = printedTickets
    .filter((t: any) => t.status !== "scanne")
    .reduce((sum: number, t: any) => sum + (t.price || 0), 0);

  const totalSold = periodTickets.filter((t: any) => t.counts_as_revenue && t.status !== "annule").length;
  const totalRevenue = periodTickets
    .filter((t: any) => t.counts_as_revenue && t.status !== "annule")
    .reduce((sum: number, t: any) => sum + t.price, 0);

  const odcavCommission = Math.round(totalRevenue * odcavRate);
  const fraisPlateformePeriod = totalPrinted * 10;

  // Build revenueByMatch: initialise from matches, fill from tickets
  const revenueByMatch: Record<string, {
    homeTeam: string; awayTeam: string; date: string;
    printed: number; unsold: number; revenue: number;
  }> = {};
  (matchesInPeriod || []).forEach((m: any) => {
    revenueByMatch[m.id] = {
      homeTeam: m.home_team,
      awayTeam: m.away_team,
      date: m.match_date,
      printed: 0,
      unsold: 0,
      revenue: 0,
    };
  });
  periodTickets.forEach((t: any) => {
    const matchData = revenueByMatch[t.match_id];
    if (!matchData) return;
    if (t.bloc_printed) {
      matchData.printed++;
      if (t.status !== "scanne") matchData.unsold++;
    }
    if (t.counts_as_revenue && t.status !== "annule") {
      matchData.revenue += t.price;
    }
  });

  // ── Expenses ─────────────────────────────────────────────────────
  const expenseFrom = dateStart.toISOString().split("T")[0];
  const expenseTo = dateEnd.toISOString().split("T")[0];

  let expensesQuery = supabase
    .from("expenses")
    .select("*, match:matches(home_team, away_team), adder:profiles!expenses_added_by_fkey(full_name)")
    .order("expense_date", { ascending: false });

  if (filterMatchId) {
    expensesQuery = expensesQuery.eq("match_id", filterMatchId);
  } else {
    expensesQuery = expensesQuery
      .gte("expense_date", expenseFrom)
      .lte("expense_date", expenseTo);
  }

  if (zoneId) expensesQuery = expensesQuery.eq("zone_id", zoneId);

  const { data: expenses } = (await expensesQuery) as { data: any[] | null };
  const totalExpenses = expenses?.reduce((sum: number, e: any) => sum + e.amount, 0) || 0;
  const balance = totalRevenue - totalExpenses - odcavCommission - fraisPlateformePeriod;

  const expensesByMatchId: Record<string, number> = {};
  expenses?.forEach((e: any) => {
    if (e.match_id) {
      expensesByMatchId[e.match_id] = (expensesByMatchId[e.match_id] || 0) + e.amount;
    }
  });

  // ── Matches for filter dropdown ───────────────────────────────────
  let matchesListQuery = supabase
    .from("matches")
    .select("id, home_team, away_team")
    .order("match_date", { ascending: false });
  if (c3AccountId) matchesListQuery = matchesListQuery.eq("c3_account_id", c3AccountId);
  else if (zoneId) matchesListQuery = matchesListQuery.eq("zone_id", zoneId);
  const { data: matchesList } = await matchesListQuery;
  const filterMatches = (matchesList || []).map((m: any) => ({
    id: m.id,
    label: `${m.home_team} vs ${m.away_team}`,
  }));

  return (
    <div className="space-y-6 min-w-0">
      {["super_admin","president_odcav","tresorier"].includes(profile.role) && selectedZone && <ZoneBackHeader zoneName={selectedZone.name} />}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading">Finances</h1>
          <p className="text-muted-foreground">{periodLabel}</p>
        </div>
        <div className="flex gap-2">
          <PrintButton label="PDF" />
          <Link href={buildZoneUrl("/finances/depenses/nouveau", params.zone)}>
            <Button className="bg-brand hover:bg-brand/90">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter une dépense
            </Button>
          </Link>
        </div>
      </div>

      <FinancesFilters
        currentPeriod={period}
        currentDate={period === "jour" ? (params.date || today) : undefined}
        currentFrom={params.from}
        currentTo={params.to}
        currentMatch={filterMatchId || undefined}
        zoneParam={params.zone}
        matches={filterMatches}
      />

      {/* Blocs imprimés + Validés + Invendus */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Blocs imprimés</p>
                <p className="text-2xl font-bold">{totalBlocs}</p>
                <p className="text-xs text-muted-foreground mt-1">{totalPrinted} billet{totalPrinted !== 1 ? "s" : ""}</p>
              </div>
              <Layers className="h-8 w-8 text-accent/60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Validés par scan</p>
                <p className="text-2xl font-bold text-green-600">{totalScanned}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {totalPrinted > 0 ? `${Math.round((totalScanned / totalPrinted) * 100)}%` : "0%"} des imprimés
                </p>
              </div>
              <ScanLine className="h-8 w-8 text-green-400/60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Invendus</p>
                <p className="text-2xl font-bold text-orange-600">{totalUnsold}</p>
                {totalUnsoldValue > 0 && (
                  <p className="text-xs text-orange-500 mt-1">−{formatFCFA(totalUnsoldValue)}</p>
                )}
              </div>
              <PackageX className="h-8 w-8 text-orange-400/40" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recettes brutes + Dépenses */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Recettes brutes</p>
                <p className="text-2xl font-bold text-brand">{formatFCFA(totalRevenue)}</p>
                <p className="text-xs text-muted-foreground mt-1">{totalSold} billet(s) vendu(s)</p>
              </div>
              <Banknote className="h-8 w-8 text-brand/40" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Dépenses</p>
                <p className="text-2xl font-bold text-danger">{formatFCFA(totalExpenses)}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-danger/40" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Déductions obligatoires */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-blue-200 bg-blue-50/40">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700 font-medium">Commission ODCAV ({(odcavRate * 100).toFixed(0)}%)</p>
                <p className="text-xl font-bold text-blue-800">{formatFCFA(odcavCommission)}</p>
                <p className="text-xs text-blue-600 mt-0.5">À reverser à l&apos;ODCAV</p>
              </div>
              <Landmark className="h-7 w-7 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50/40">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-700 font-medium">Frais billetterie</p>
                <p className="text-xl font-bold text-orange-800">{formatFCFA(fraisPlateformePeriod)}</p>
                <p className="text-xs text-orange-600 mt-0.5">{totalPrinted} billet{totalPrinted !== 1 ? "s" : ""} × 10 FCFA</p>
              </div>
              <ReceiptText className="h-7 w-7 text-orange-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Solde net */}
      <Card className={`border-2 ${balance >= 0 ? "border-success/30 bg-success/5" : "border-danger/30 bg-danger/5"}`}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Net à reverser à la zone</p>
              <p className={`text-3xl font-bold ${balance >= 0 ? "text-success" : "text-danger"}`}>
                {formatFCFA(Math.max(0, balance))}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Recettes − Dépenses − ODCAV − Frais plateforme</p>
            </div>
            <TrendingUp className="h-10 w-10 text-muted-foreground/20" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Recettes par match</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="py-2 text-xs">Match</TableHead>
                <TableHead className="py-2 text-xs text-right">Imprimé</TableHead>
                <TableHead className="py-2 text-xs text-right text-red-600">Invendus</TableHead>
                <TableHead className="py-2 text-xs text-right text-danger">Dépenses</TableHead>
                <TableHead className="py-2 text-xs text-right font-bold text-brand">Recettes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(revenueByMatch).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Aucune recette sur cette période
                  </TableCell>
                </TableRow>
              ) : (
                Object.entries(revenueByMatch).map(([id, data]) => {
                  const matchExp = expensesByMatchId[id] || 0;
                  const recettes = data.revenue - matchExp;
                  return (
                    <TableRow key={id} className="text-sm">
                      <TableCell className="py-2">
                        <p className="font-medium text-xs leading-snug">{data.homeTeam} vs {data.awayTeam}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(data.date)}</p>
                      </TableCell>
                      <TableCell className="py-2 text-right text-xs">{data.printed}</TableCell>
                      <TableCell className="py-2 text-right text-xs font-medium text-red-600">{data.unsold > 0 ? data.unsold : "—"}</TableCell>
                      <TableCell className="py-2 text-right text-xs font-medium text-danger whitespace-nowrap">{matchExp > 0 ? `-${formatFCFA(matchExp)}` : "—"}</TableCell>
                      <TableCell className={`py-2 text-right text-xs font-bold whitespace-nowrap ${recettes >= 0 ? "text-brand" : "text-danger"}`}>
                        {formatFCFA(recettes)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Dépenses</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead className="hidden sm:table-cell">Catégorie</TableHead>
                <TableHead className="hidden md:table-cell">Match</TableHead>
                <TableHead className="text-right">Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!expenses || expenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Aucune dépense sur cette période
                  </TableCell>
                </TableRow>
              ) : (
                expenses.map((expense: any) => (
                  <TableRow key={expense.id}>
                    <TableCell className="hidden sm:table-cell text-sm">{formatDate(expense.expense_date)}</TableCell>
                    <TableCell className="font-medium">{expense.label}</TableCell>
                    <TableCell className="hidden sm:table-cell capitalize">
                      {EXPENSE_CATEGORY_LABELS[expense.category] || expense.category}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {expense.match ? `${expense.match.home_team} vs ${expense.match.away_team}` : "Global zone"}
                    </TableCell>
                    <TableCell className="text-right font-bold text-danger">-{formatFCFA(expense.amount)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

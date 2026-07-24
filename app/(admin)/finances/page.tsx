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
import { FinancesOdcavTabs } from "./finances-odcav-tabs";
import { fetchAll } from "@/lib/supabase/paginate";
import { ExpenseRowActions } from "./expense-row-actions";
import { FicheRecettesButton } from "./fiche-recettes-button";

export const metadata = { title: "Finances" };

/* eslint-disable @typescript-eslint/no-explicit-any */

type Period = "24h" | "jour" | "mois" | "custom";

export default async function FinancesPage({
  searchParams,
}: {
  searchParams: Promise<{ zone?: string; period?: string; date?: string; from?: string; to?: string; match?: string }>;
}) {
  const profile = await requireRole(["super_admin", "admin_zone", "c3", "fondateur", "president_odcav", "tresorier"]);
  const params = await searchParams;

  const isOdcavRole =
    profile.role === "super_admin" ||
    profile.role === "president_odcav" ||
    profile.role === "tresorier";

  const { effectiveZoneId, selectedZone, ownedZones, needsZoneSelection, c3AccountId, c3ZoneIds } =
    await getEffectiveZone(profile, params.zone);

  if (needsZoneSelection) {
    if (isOdcavRole) {
      return (
        <div className="space-y-6">
          <FinancesOdcavTabs active="zone" />
          <ZoneCardGrid zones={ownedZones} title="Finances Zone" />
        </div>
      );
    }
    return <ZoneCardGrid zones={ownedZones} title="Finances" />;
  }

  const supabase = await createClient();
  const adminSupabase = await createAdminClient();
  const zoneId = effectiveZoneId;

  // C3 voit ses propres matchs + matchs des zones affiliées
  let c3AllMatchIds: string[] | null = null;
  if (c3AccountId) {
    const queries: any[] = [
      adminSupabase.from("matches").select("id").eq("c3_account_id", c3AccountId),
    ];
    if (c3ZoneIds.length > 0) {
      queries.push(adminSupabase.from("matches").select("id").in("zone_id", c3ZoneIds));
    }
    const results: any[] = await Promise.all(queries);
    c3AllMatchIds = [...new Set(
      results.flatMap((r) => (r.data || []).map((m: any) => m.id as string))
    )];
  }

  const today = new Date().toISOString().split("T")[0];
  const period = (params.period as Period) || "jour";
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
  if (c3AllMatchIds !== null) {
    if (c3AllMatchIds.length > 0) matchesPeriodQuery = (matchesPeriodQuery as any).in("id", c3AllMatchIds);
    else matchesPeriodQuery = (matchesPeriodQuery as any).eq("id", "00000000-0000-0000-0000-000000000000");
  } else if (zoneId) matchesPeriodQuery = matchesPeriodQuery.eq("zone_id", zoneId);

  const { data: matchesInPeriod } = await matchesPeriodQuery;
  const matchIdsInPeriod = (matchesInPeriod || []).map((m: any) => m.id as string);

  // ── Regular tickets for those matches ───────────────────────────
  let periodTickets: any[] = [];
  if (matchIdsInPeriod.length > 0) {
    periodTickets = await fetchAll<any>((from, to) =>
      adminSupabase.from("tickets").select("price, status, bloc_printed, counts_as_revenue, match_id").in("match_id", matchIdsInPeriod).range(from, to)
    );
  }

  // ── Billeterie tickets covering matches for this account ─────────────
  let bilPrinted = 0;
  let bilScanned = 0;
  let bilRevenue = 0;

  {
    // Pour les scans : utiliser TOUS les matchs C3 (pas seulement ceux de la période)
    // car le scan peut être attribué à un match antérieur encore en_cours via la chaîne.
    const scanMatchIds = c3AllMatchIds !== null ? c3AllMatchIds : matchIdsInPeriod;
    if (scanMatchIds.length > 0) {
      const scanMatchIdSet = new Set(scanMatchIds);
      const { data: allBils } = await adminSupabase.from("billeterie").select("id, price, match_ids");

      const allC3Bils = (allBils || []).filter((b: any) =>
        (b.match_ids || []).some((id: string) => scanMatchIdSet.has(id))
      );
      const allC3BilIds = allC3Bils.map((b: any) => b.id as string);
      const bilPriceMap: Record<string, number> = {};
      allC3Bils.forEach((b: any) => { bilPriceMap[b.id] = b.price || 0; });

      const periodMatchSet = new Set(matchIdsInPeriod);
      const bilsInPeriod = allC3Bils.filter((b: any) =>
        (b.match_ids || []).some((id: string) => periodMatchSet.has(id))
      );
      const periodBilIdSet = new Set(bilsInPeriod.map((b: any) => b.id as string));

      if (allC3BilIds.length > 0) {
        const allBilMatchIds = [...new Set(
          allC3Bils.flatMap((b: any) => (b.match_ids || []) as string[])
        )];

        const [bilAllTickets, allBilScans] = await Promise.all([
          fetchAll<any>((from, to) =>
            adminSupabase.from("billeterie_tickets")
              .select("id, billeterie_id, withdrawn")
              .in("billeterie_id", allC3BilIds)
              .range(from, to)
          ),
          fetchAll<any>((from, to) =>
            adminSupabase.from("billeterie_scans").select("ticket_id, scanned_at")
              .in("match_id", allBilMatchIds).range(from, to)
          ),
        ]);

        const nonWithdrawnByBil: Record<string, number> = {};
        const ticketIdToBilId: Record<string, string> = {};
        bilAllTickets.forEach((t: any) => {
          ticketIdToBilId[t.id as string] = t.billeterie_id as string;
          if (!t.withdrawn) {
            nonWithdrawnByBil[t.billeterie_id] = (nonWithdrawnByBil[t.billeterie_id] || 0) + 1;
          }
        });

        const bilTicketIdSet = new Set(Object.keys(ticketIdToBilId));
        const relevantScans = allBilScans.filter((s: any) => bilTicketIdSet.has(s.ticket_id as string));

        const dateStartMs = dateStart.getTime();
        const dateEndMs = dateEnd.getTime();

        const totalScansByBil: Record<string, number> = {};
        const periodScansByBil: Record<string, number> = {};
        relevantScans.forEach((s: any) => {
          const bilId = ticketIdToBilId[s.ticket_id as string];
          if (!bilId) return;
          totalScansByBil[bilId] = (totalScansByBil[bilId] || 0) + 1;
          const scannedAtMs = new Date(s.scanned_at as string).getTime();
          if (scannedAtMs >= dateStartMs && scannedAtMs <= dateEndMs) {
            periodScansByBil[bilId] = (periodScansByBil[bilId] || 0) + 1;
          }
        });

        bilPrinted = [...periodBilIdSet].reduce((sum: number, bilId: string) => {
          const nonWithdrawn = nonWithdrawnByBil[bilId] || 0;
          const totalScans = totalScansByBil[bilId] || 0;
          const periodScansCount = periodScansByBil[bilId] || 0;
          return sum + Math.max(0, nonWithdrawn - (totalScans - periodScansCount));
        }, 0);

        const periodScans = relevantScans.filter((s: any) => {
          const scannedAtMs = new Date(s.scanned_at as string).getTime();
          return scannedAtMs >= dateStartMs && scannedAtMs <= dateEndMs;
        });
        bilScanned = periodScans.length;
        bilRevenue = periodScans.reduce((s: number, scan: any) => {
          const bilId = ticketIdToBilId[scan.ticket_id as string];
          return s + (bilId ? (bilPriceMap[bilId] || 0) : 0);
        }, 0);
      }
    }
  }

  // ── Financial metrics (regular tickets + billeterie combinés) ────
  const printedTickets = periodTickets.filter((t: any) => t.bloc_printed === true);
  const regularPrinted = printedTickets.length;
  const totalPrinted = regularPrinted + bilPrinted;
  const totalBlocs = Math.floor(totalPrinted / 100);
  const regularScanned = periodTickets.filter((t: any) => t.status === "scanne").length;
  const totalScanned = regularScanned + bilScanned;
  const totalUnsold = Math.max(0, totalPrinted - totalScanned);
  const totalUnsoldValue = printedTickets
    .filter((t: any) => t.status !== "scanne")
    .reduce((sum: number, t: any) => sum + (t.price || 0), 0);

  const totalSold = periodTickets.filter((t: any) => t.counts_as_revenue && t.status === "scanne").length;
  const totalRevenue = periodTickets
    .filter((t: any) => t.counts_as_revenue && t.status === "scanne")
    .reduce((sum: number, t: any) => sum + t.price, 0) + bilRevenue;

  const odcavCommission = Math.round(totalRevenue * odcavRate);
  const fraisPlateformePeriod = totalScanned * 10;

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

  // ── Matches for filter dropdown ───────────────────────────────────
  let matchesListQuery = supabase
    .from("matches")
    .select("id, home_team, away_team")
    .order("match_date", { ascending: false });
  if (c3AllMatchIds !== null) {
    if (c3AllMatchIds.length > 0) matchesListQuery = (matchesListQuery as any).in("id", c3AllMatchIds);
    else matchesListQuery = (matchesListQuery as any).eq("id", "00000000-0000-0000-0000-000000000000");
  } else if (zoneId) matchesListQuery = matchesListQuery.eq("zone_id", zoneId);
  const { data: matchesList } = await matchesListQuery;
  const filterMatches = (matchesList || []).map((m: any) => ({
    id: m.id,
    label: `${m.home_team} vs ${m.away_team}`,
  }));

  return (
    <div className="space-y-6 min-w-0">
      {isOdcavRole && <FinancesOdcavTabs active="zone" />}
      {/* Print-only header */}
      <div className="hidden print:block border-b-2 border-gray-800 pb-4 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Rapport Financier — Guichet Foot</h1>
            <p className="text-base text-gray-600 mt-1">{selectedZone?.name || profile.zone?.name || "Zone"}</p>
            <p className="text-sm text-gray-500 mt-0.5">Période : {periodLabel}</p>
          </div>
          <p className="text-xs text-gray-400">Imprimé le {dateEnd.toLocaleDateString("fr-FR")}</p>
        </div>
      </div>

      <div className="print:hidden">
        {["super_admin","president_odcav","tresorier"].includes(profile.role) && selectedZone && <ZoneBackHeader zoneName={selectedZone.name} />}
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading print:hidden">Finances</h1>
          <p className="text-muted-foreground print:hidden">{periodLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <FicheRecettesButton
            date={period === "jour" ? (params.date || today) : today}
            zoneId={zoneId}
            c3AccountId={c3AccountId}
          />
          <Link href={buildZoneUrl("/finances/depenses/nouveau", params.zone)}>
            <Button className="bg-brand hover:bg-brand/90">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter une dépense
            </Button>
          </Link>
        </div>
      </div>

      <div className="print:hidden">
        <FinancesFilters
          currentPeriod={period}
          currentDate={period === "jour" ? (params.date || today) : undefined}
          currentFrom={params.from}
          currentTo={params.to}
          currentMatch={filterMatchId || undefined}
          zoneParam={params.zone}
          matches={filterMatches}
        />
      </div>

      {/* Blocs imprimés + Validés + Invendus */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Blocs imprimés</p>
                <p className="text-2xl font-bold">{totalBlocs}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {totalPrinted} billet{totalPrinted !== 1 ? "s" : ""}
                  {totalPrinted % 100 !== 0 && totalPrinted > 0 && (
                    <span className="text-orange-500"> · {totalPrinted % 100} hors bloc</span>
                  )}
                </p>
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
                <p className="text-xs text-orange-600 mt-0.5">{totalScanned} billet{totalScanned !== 1 ? "s" : ""} validé{totalScanned !== 1 ? "s" : ""} × 10 FCFA</p>
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
              <p className="text-xs text-muted-foreground mt-1">Recettes − Dépenses − ODCAV − Frais billetterie</p>
            </div>
            <TrendingUp className="h-10 w-10 text-muted-foreground/20" />
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="bg-[#1a5c1a] text-white font-bold px-4 py-3 text-sm">
          Match
        </div>
        {!matchesInPeriod || matchesInPeriod.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 text-sm">
            Aucun match sur cette période
          </div>
        ) : (
          <>
            <div className="divide-y divide-border">
              {matchesInPeriod.map((m: any) => (
                <div key={m.id} className="px-4 py-3 text-sm">
                  {m.home_team} vs {m.away_team}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 border-t-2 border-border">
              <div className="bg-green-100 dark:bg-green-950/40 px-3 py-3 border-r border-border">
                <p className="text-xs text-green-700 dark:text-green-400">Billets Imprimés</p>
                <p className="text-lg font-bold text-green-900 dark:text-green-200">{totalPrinted}</p>
              </div>
              <div className="bg-blue-600 px-3 py-3 border-r border-blue-500">
                <p className="text-xs text-blue-200">Validé</p>
                <p className="text-lg font-bold text-white">{totalScanned}</p>
              </div>
              <div className="bg-red-100 dark:bg-red-950/40 px-3 py-3 border-r border-border">
                <p className="text-xs text-red-600 dark:text-red-400">Invendus</p>
                <p className="text-lg font-bold text-red-700 dark:text-red-300">{totalUnsold}</p>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-950/30 px-3 py-3">
                <p className="text-xs text-yellow-700 dark:text-yellow-400">Recettes Bruites</p>
                <p className="text-lg font-bold text-yellow-900 dark:text-yellow-200 whitespace-nowrap">{formatFCFA(totalRevenue)}</p>
              </div>
            </div>
          </>
        )}
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
                <TableHead className="w-20 print:hidden" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {!expenses || expenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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
                    <TableCell className="print:hidden">
                      <ExpenseRowActions
                        expense={{
                          id: expense.id,
                          label: expense.label,
                          category: expense.category,
                          amount: expense.amount,
                          expense_date: expense.expense_date,
                          match_id: expense.match_id,
                          notes: expense.notes,
                        }}
                        matches={filterMatches}
                      />
                    </TableCell>
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

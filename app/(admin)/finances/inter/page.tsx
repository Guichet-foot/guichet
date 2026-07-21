import { requireRole } from "@/lib/auth";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Banknote, TrendingDown, TrendingUp, Landmark, PackageX, Layers, ScanLine, ReceiptText } from "lucide-react";
import { formatFCFA, formatDate } from "@/lib/format";
import { FinancesOdcavTabs } from "@/app/(admin)/finances/finances-odcav-tabs";
import { InterFilters } from "./inter-filters";
import { fetchAll } from "@/lib/supabase/paginate";

export const metadata = { title: "Finances Inter-Zones" };

/* eslint-disable @typescript-eslint/no-explicit-any */

type Period = "24h" | "jour" | "mois" | "custom";

export default async function FinancesInterPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; period?: string; date?: string; from?: string; to?: string; match?: string }>;
}) {
  const profile = await requireRole(["super_admin", "fondateur", "president_odcav", "tresorier"]);
  const params = await searchParams;

  const typeParam = params.type === "departemental" ? "departemental" : "communal";
  const matchType = typeParam === "departemental" ? "Match Départemental" : "Match Communal";
  const tabLabel = typeParam === "departemental" ? "Départemental" : "Communal";

  const adminSupabase = await createAdminClient();

  // ── ODCAV isolation: build the set of creator IDs this user can see ──
  // fondateur, super_admin, president_odcav → no filter (see all)
  // tresorier → scoped to parent's data
  let creatorIds: string[] | null = null; // null = no filter
  let ownerId: string = profile.id;
  if (profile.role === "tresorier") {
    ownerId = profile.created_by_admin ?? profile.id;
    const { data: subAdmins } = await adminSupabase
      .from("profiles")
      .select("id")
      .eq("created_by_admin", ownerId);
    creatorIds = [ownerId, ...((subAdmins || []) as any[]).map((p: any) => p.id as string)];
  }

  // C3 accounts belonging to this ODCAV (used only for the Communal tab)
  let c3AccountIds: string[] = [];
  if (typeParam === "communal") {
    const c3Query = adminSupabase.from("profiles").select("id").eq("role", "c3");
    // fondateur et super_admin voient tous les comptes C3 (même organisation)
    const { data: c3Accounts } =
      (profile.role === "fondateur" || profile.role === "super_admin")
        ? await c3Query
        : await c3Query.eq("created_by_admin", ownerId);
    c3AccountIds = ((c3Accounts || []) as any[]).map((p: any) => p.id as string);
  }

  const today = new Date().toISOString().split("T")[0];
  const period = (params.period as Period) || "jour";
  const filterMatchId = params.match || null;

  // If filtering by a C3 match, scans can't be split per-match (shared billeterie)
  // Expand scan scope to ALL match_ids from the billeterie that covers the selected match
  let isC3MatchFilter = false;
  if (filterMatchId && typeParam === "communal") {
    const { data: fm } = await adminSupabase
      .from("matches")
      .select("c3_account_id")
      .eq("id", filterMatchId)
      .maybeSingle();
    isC3MatchFilter = !!fm?.c3_account_id;
  }

  let dateStart: Date;
  let dateEnd: Date;
  let periodLabel: string;
  let settingsDate = today;

  if (period === "24h") {
    dateEnd = new Date();
    dateStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
    periodLabel = "Dernières 24h";
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
    dateStart = new Date();
    dateStart.setDate(1);
    dateStart.setHours(0, 0, 0, 0);
    dateEnd = new Date();
    dateEnd.setHours(23, 59, 59, 999);
    periodLabel = "Mois en cours";
  }

  if (filterMatchId) {
    periodLabel = isC3MatchFilter ? "Billetterie C3 — tous les matchs partagés" : "Match sélectionné";
  }

  // ── Platform settings ────────────────────────────────────────────
  const { data: platformData } = await adminSupabase
    .from("platform_settings")
    .select("odcav_rate")
    .lte("effective_date", settingsDate)
    .order("effective_date", { ascending: false })
    .limit(1)
    .single();
  const odcavRate = platformData?.odcav_rate ?? 0.05;

  // ── Matches in period ────────────────────────────────────────────
  // 1. ODCAV inter-matches (communal or departmental)
  let odcavMatchQuery: any = adminSupabase
    .from("matches")
    .select("id, home_team, away_team, match_date")
    .eq("match_type", matchType)
    .is("zone_id", null);
  if (creatorIds) odcavMatchQuery = odcavMatchQuery.in("created_by", creatorIds);
  if (filterMatchId) {
    odcavMatchQuery = odcavMatchQuery.eq("id", filterMatchId);
  } else {
    odcavMatchQuery = odcavMatchQuery
      .gte("match_date", dateStart.toISOString())
      .lte("match_date", dateEnd.toISOString());
  }
  const { data: odcavMatchesData } = await odcavMatchQuery;
  const matchesInPeriod: any[] = [...(odcavMatchesData || [])];

  // 2. C3 matches (treated as communal — no match_type, identified by c3_account_id)
  if (typeParam === "communal" && c3AccountIds.length > 0) {
    let c3MatchQuery: any = adminSupabase
      .from("matches")
      .select("id, home_team, away_team, match_date")
      .in("c3_account_id", c3AccountIds);
    if (filterMatchId) {
      c3MatchQuery = c3MatchQuery.eq("id", filterMatchId);
    } else {
      c3MatchQuery = c3MatchQuery
        .gte("match_date", dateStart.toISOString())
        .lte("match_date", dateEnd.toISOString());
    }
    const { data: c3Matches } = await c3MatchQuery;
    const existingIds = new Set(matchesInPeriod.map((m: any) => m.id as string));
    for (const m of (c3Matches || []) as any[]) {
      if (!existingIds.has(m.id as string)) matchesInPeriod.push(m);
    }
  }

  const matchIdsInPeriod = matchesInPeriod.map((m: any) => m.id as string);

  // ── Regular tickets for those matches ───────────────────────────
  let periodTickets: any[] = [];
  if (matchIdsInPeriod.length > 0) {
    periodTickets = await fetchAll<any>((from, to) =>
      adminSupabase.from("tickets").select("price, status, bloc_printed, counts_as_revenue, match_id").in("match_id", matchIdsInPeriod).range(from, to)
    );
  }

  // ── Billeterie tickets for inter-matches (scans filtrés par scanned_at) ─────
  // On cherche TOUTES les billeteries liées aux matchs inter (pas seulement ceux
  // de la période), afin que les scans faits aujourd'hui sur d'anciens billets
  // soient correctement comptabilisés.
  let bilPrinted = 0;
  let bilScanned = 0;
  let bilRevenue = 0;
  {
    // Tous les matchs C3 (toutes périodes confondues) pour découvrir les billeteries
    let allC3MatchIdsEver: string[] = [];
    if (typeParam === "communal" && c3AccountIds.length > 0) {
      const { data: c3md } = await adminSupabase
        .from("matches").select("id").in("c3_account_id", c3AccountIds);
      allC3MatchIdsEver = ((c3md || []) as any[]).map((m: any) => m.id as string);
    }
    // Tous les matchs ODCAV inter (toutes périodes confondues)
    let allOdcavMatchIdsEver: string[] = [];
    {
      let q: any = adminSupabase
        .from("matches").select("id").eq("match_type", matchType).is("zone_id", null);
      if (creatorIds) q = q.in("created_by", creatorIds);
      const { data: odmd } = await q;
      allOdcavMatchIdsEver = ((odmd || []) as any[]).map((m: any) => m.id as string);
    }

    const allInterMatchIds = [...new Set([...allOdcavMatchIdsEver, ...allC3MatchIdsEver])];
    if (allInterMatchIds.length > 0) {
      const allInterMatchIdSet = new Set(allInterMatchIds);

      const { data: allBilsData } = await adminSupabase
        .from("billeterie").select("id, price, match_ids");
      const allInterBils = ((allBilsData || []) as any[]).filter((b: any) =>
        (b.match_ids || []).some((id: string) => allInterMatchIdSet.has(id))
      );

      if (allInterBils.length > 0) {
        const allBilIds = allInterBils.map((b: any) => b.id as string);
        const bilPriceMap: Record<string, number> = {};
        allInterBils.forEach((b: any) => { bilPriceMap[b.id] = b.price || 0; });

        const allBilMatchIds = [...new Set(
          allInterBils.flatMap((b: any) => (b.match_ids || []) as string[])
        )];

        // Pour le filtre par match C3, étendre matchesInPeriod avec les matchs partagés
        if (isC3MatchFilter && matchIdsInPeriod.length > 0) {
          const matchIdSet = new Set(matchIdsInPeriod);
          const bilsForFilter = allInterBils.filter((b: any) =>
            (b.match_ids || []).some((id: string) => matchIdSet.has(id))
          );
          const extraIds = new Set<string>();
          for (const b of bilsForFilter) {
            for (const mid of (b.match_ids as string[] || [])) {
              if (!matchIdSet.has(mid)) extraIds.add(mid);
            }
          }
          if (extraIds.size > 0) {
            const { data: extraMatchData } = await adminSupabase
              .from("matches").select("id, home_team, away_team, match_date").in("id", [...extraIds]);
            for (const m of (extraMatchData || []) as any[]) matchesInPeriod.push(m);
          }
        }

        // Billeteries ayant au moins un match dans la période (pour bilPrinted)
        const periodMatchSet = new Set(matchIdsInPeriod);
        const periodBilIds = new Set(
          allInterBils.filter((b: any) =>
            (b.match_ids || []).some((id: string) => periodMatchSet.has(id))
          ).map((b: any) => b.id as string)
        );

        const [bilAllTickets, allBilScans] = await Promise.all([
          fetchAll<any>((from, to) =>
            adminSupabase.from("billeterie_tickets")
              .select("id, billeterie_id, withdrawn")
              .in("billeterie_id", allBilIds)
              .range(from, to)
          ),
          fetchAll<any>((from, to) =>
            adminSupabase.from("billeterie_scans")
              .select("ticket_id, scanned_at")
              .in("match_id", allBilMatchIds)
              .range(from, to)
          ),
        ]);

        const nonWithdrawnByBil: Record<string, number> = {};
        const ticketIdToBilId: Record<string, string> = {};
        bilAllTickets.forEach((t: any) => {
          ticketIdToBilId[t.id] = t.billeterie_id;
          if (!t.withdrawn) {
            nonWithdrawnByBil[t.billeterie_id] = (nonWithdrawnByBil[t.billeterie_id] || 0) + 1;
          }
        });

        const bilTicketIdSet = new Set(Object.keys(ticketIdToBilId));
        const relevantScans = allBilScans.filter((s: any) =>
          bilTicketIdSet.has(s.ticket_id as string)
        );

        const dateStartMs = dateStart.getTime();
        const dateEndMs   = dateEnd.getTime();

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

        // bilPrinted = billets disponibles (non-retirés) au début de la période
        bilPrinted = [...periodBilIds].reduce((sum: number, bilId: string) => {
          const nw = nonWithdrawnByBil[bilId] || 0;
          const ts = totalScansByBil[bilId] || 0;
          const ps = periodScansByBil[bilId] || 0;
          return sum + Math.max(0, nw - (ts - ps));
        }, 0);

        const periodBilScans = relevantScans.filter((s: any) => {
          const scannedAtMs = new Date(s.scanned_at as string).getTime();
          return scannedAtMs >= dateStartMs && scannedAtMs <= dateEndMs;
        });
        bilScanned = periodBilScans.length;
        bilRevenue = periodBilScans.reduce((s: number, sc: any) => {
          const bilId = ticketIdToBilId[sc.ticket_id as string];
          return s + (bilId ? bilPriceMap[bilId] || 0 : 0);
        }, 0);
      }
    }
  }

  // ── Financial metrics ────────────────────────────────────────────
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

  // ── Expenses for these inter-matches ────────────────────────────
  let expenses: any[] = [];
  let totalExpenses = 0;
  if (matchIdsInPeriod.length > 0) {
    const { data: expData } = await adminSupabase
      .from("expenses")
      .select("*, match:matches(home_team, away_team)")
      .in("match_id", matchIdsInPeriod)
      .order("expense_date", { ascending: false });
    expenses = expData || [];
    totalExpenses = expenses.reduce((s: number, e: any) => s + e.amount, 0);
  }

  const balance = totalRevenue - totalExpenses - odcavCommission - fraisPlateformePeriod;

  // ── Match list for filter dropdown ────────────────────────────────
  let matchesListQuery: any = adminSupabase
    .from("matches")
    .select("id, home_team, away_team")
    .eq("match_type", matchType)
    .is("zone_id", null)
    .order("match_date", { ascending: false });
  if (creatorIds) matchesListQuery = matchesListQuery.in("created_by", creatorIds);
  const { data: matchesList } = await matchesListQuery;

  let allMatchesList = [...((matchesList || []) as any[])];
  if (typeParam === "communal" && c3AccountIds.length > 0) {
    const { data: c3MatchesList } = await adminSupabase
      .from("matches")
      .select("id, home_team, away_team")
      .in("c3_account_id", c3AccountIds)
      .order("match_date", { ascending: false });
    const existingIds = new Set(allMatchesList.map((m: any) => m.id as string));
    for (const m of (c3MatchesList || []) as any[]) {
      if (!existingIds.has(m.id as string)) allMatchesList.push(m);
    }
  }
  const filterMatches = allMatchesList.map((m: any) => ({
    id: m.id,
    label: `${m.home_team} vs ${m.away_team}`,
  }));

  return (
    <div className="space-y-6 min-w-0">
      <FinancesOdcavTabs active={typeParam as "communal" | "departemental"} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading">Finances {tabLabel}</h1>
          <p className="text-muted-foreground">{periodLabel}</p>
        </div>
      </div>

      <InterFilters
        typeParam={typeParam}
        currentPeriod={period}
        currentDate={period === "jour" ? (params.date || today) : undefined}
        currentFrom={params.from}
        currentTo={params.to}
        currentMatch={filterMatchId || undefined}
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
              <p className="text-sm text-muted-foreground">Net à reverser à l&apos;ODCAV</p>
              <p className={`text-3xl font-bold ${balance >= 0 ? "text-success" : "text-danger"}`}>
                {formatFCFA(Math.max(0, balance))}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Recettes − Dépenses − ODCAV − Frais billetterie</p>
            </div>
            <TrendingUp className="h-10 w-10 text-muted-foreground/20" />
          </div>
        </CardContent>
      </Card>

      {/* Matchs de la période */}
      <Card className="overflow-hidden">
        <div className="bg-[#1a5c1a] text-white font-bold px-4 py-3 text-sm">
          Matchs {tabLabel}
        </div>
        {!matchesInPeriod || matchesInPeriod.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 text-sm">
            Aucun match {tabLabel.toLowerCase()} sur cette période
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
                <p className="text-xs text-yellow-700 dark:text-yellow-400">Recettes Brutes</p>
                <p className="text-lg font-bold text-yellow-900 dark:text-yellow-200 whitespace-nowrap">{formatFCFA(totalRevenue)}</p>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Dépenses liées aux matchs */}
      {expenses.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Dépenses</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead className="hidden md:table-cell">Match</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense: any) => (
                  <TableRow key={expense.id}>
                    <TableCell className="hidden sm:table-cell text-sm">{formatDate(expense.expense_date)}</TableCell>
                    <TableCell className="font-medium">{expense.label}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {expense.match ? `${expense.match.home_team} vs ${expense.match.away_team}` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-bold text-danger">-{formatFCFA(expense.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

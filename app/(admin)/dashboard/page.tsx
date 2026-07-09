import { requireRole } from "@/lib/auth";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getEffectiveZone } from "@/lib/get-effective-zone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Banknote, Ticket, PackageX } from "lucide-react";
import { formatFCFA, formatDateShort } from "@/lib/format";
import { MATCH_STATUS_LABELS, MATCH_STATUS_COLORS } from "@/lib/constants";
import { SalesChart } from "./sales-chart";
import { RevenueDonut } from "./revenue-donut";
import { DashboardFilters } from "./dashboard-filters";
import { ZoneCardGrid } from "@/components/zone-card-grid";
import { ZoneBackHeader } from "@/components/zone-back-header";

export const metadata = { title: "Tableau de bord" };

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ zone?: string; date?: string; year?: string; match?: string }>;
}) {
  const profile = await requireRole(["super_admin", "admin_zone", "c3"]);
  const params = await searchParams;
  const { effectiveZoneId, selectedZone, ownedZones, needsZoneSelection, c3AccountId } =
    await getEffectiveZone(profile, params.zone);

  if (needsZoneSelection) {
    return <ZoneCardGrid zones={ownedZones} title="Tableau de bord" />;
  }

  const supabase = await createClient();
  const adminClient = await createAdminClient();
  const zoneFilter = effectiveZoneId;

  // ── Active filter period ─────────────────────────────────────────
  const filterMatchId = params.match || null;
  const filterDate = params.date || null;
  const filterYear = params.year || null;
  const todayStr = new Date().toISOString().split("T")[0];

  let dateStart: Date;
  let dateEnd: Date;
  let periodLabel: string;

  if (filterDate) {
    dateStart = new Date(filterDate + "T00:00:00");
    dateEnd = new Date(filterDate + "T23:59:59.999");
    periodLabel = filterDate === todayStr ? "Aujourd'hui" : `Le ${formatDateShort(filterDate)}`;
  } else if (filterYear) {
    dateStart = new Date(`${filterYear}-01-01T00:00:00`);
    dateEnd = new Date(`${filterYear}-12-31T23:59:59.999`);
    periodLabel = `Année ${filterYear}`;
  } else {
    const m = new Date();
    m.setDate(1);
    m.setHours(0, 0, 0, 0);
    dateStart = m;
    dateEnd = new Date();
    dateEnd.setHours(23, 59, 59, 999);
    periodLabel = "Mois en cours";
  }

  // ── Matches in period (zone-scoped) — source of truth for period filter ──
  let matchesPeriodQuery = adminClient
    .from("matches")
    .select("id");

  if (filterMatchId) {
    matchesPeriodQuery = matchesPeriodQuery.eq("id", filterMatchId);
  } else {
    matchesPeriodQuery = matchesPeriodQuery
      .gte("match_date", dateStart.toISOString())
      .lte("match_date", dateEnd.toISOString());
  }
  if (c3AccountId) matchesPeriodQuery = (matchesPeriodQuery as any).eq("c3_account_id", c3AccountId);
  else if (zoneFilter) matchesPeriodQuery = matchesPeriodQuery.eq("zone_id", zoneFilter);

  const { data: matchesPeriodData } = await matchesPeriodQuery;
  const matchIdsInPeriod = (matchesPeriodData || []).map((m: any) => m.id as string);

  // ── Tickets for those matches (no sold_at filter avoids missing invendus) ──
  let periodTickets: any[] = [];
  if (matchIdsInPeriod.length > 0) {
    const { data } = await adminClient
      .from("tickets")
      .select("price, status, match_id")
      .in("match_id", matchIdsInPeriod);
    periodTickets = data || [];
  }

  // ── Match unsold — authoritative invendu counts ───────────────────
  let totalUnsold = 0;
  let totalUnsoldValue = 0;
  if (matchIdsInPeriod.length > 0) {
    const { data: unsoldRows } = await adminClient
      .from("match_unsold")
      .select("match_id, unsold_count, tout_vendus")
      .in("match_id", matchIdsInPeriod);
    (unsoldRows || []).forEach((row: any) => {
      if (!row.tout_vendus) totalUnsold += row.unsold_count || 0;
    });
    totalUnsoldValue = periodTickets
      .filter((t: any) => t.status === "annule")
      .reduce((s: number, t: any) => s + t.price, 0);
  }

  const revenueTickets = periodTickets.filter((t: any) => t.status !== "annule");
  const totalRevenue = revenueTickets.reduce((s: number, t: any) => s + t.price, 0);
  const totalSold = revenueTickets.length;

  // ── Upcoming matches ─────────────────────────────────────────────
  const now = new Date().toISOString();
  let matchQuery = supabase
    .from("matches")
    .select("*")
    .gte("match_date", now)
    .in("status", ["programme", "en_cours"])
    .order("match_date")
    .limit(5);

  if (c3AccountId) matchQuery = matchQuery.eq("c3_account_id", c3AccountId);
  else if (zoneFilter) matchQuery = matchQuery.eq("zone_id", zoneFilter);

  const { data: upcomingMatches } = await matchQuery;

  // ── 7-day chart (always last 7 days, unaffected by filters) ──────
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const { data: weekRaw } = await adminClient
    .from("tickets")
    .select("price, sold_at, match_id, match:matches(zone_id, c3_account_id)")
    .gte("sold_at", sevenDaysAgo.toISOString())
    .lte("sold_at", new Date().toISOString())
    .neq("status", "annule");

  const filteredWeekTickets = ((c3AccountId
    ? weekRaw?.filter((t: any) => t.match?.c3_account_id === c3AccountId)
    : zoneFilter
    ? weekRaw?.filter((t: any) => t.match?.zone_id === zoneFilter)
    : weekRaw) || []) as any[];

  const chartData: { date: string; ventes: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setDate(d.getDate() + i);
    const dayStr = d.toISOString().split("T")[0];
    const dayTotal = filteredWeekTickets
      .filter((t: any) => t.sold_at?.startsWith(dayStr))
      .reduce((sum: number, t: any) => sum + t.price, 0);
    chartData.push({
      date: d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }),
      ventes: dayTotal,
    });
  }

  // ── Ticket stats for upcoming match progress bars ─────────────────
  const matchIds = upcomingMatches?.map((m: any) => m.id) || [];
  const matchTicketStats: Record<string, { sold: number; total: number }> = {};

  if (matchIds.length > 0) {
    const { data: cats } = await supabase
      .from("ticket_categories")
      .select("match_id, quantity_total")
      .in("match_id", matchIds);

    const catTotals: Record<string, number> = {};
    (cats as any[])?.forEach((c: any) => {
      catTotals[c.match_id] = (catTotals[c.match_id] || 0) + c.quantity_total;
    });

    const { data: matchTickets } = await adminClient
      .from("tickets")
      .select("match_id")
      .in("match_id", matchIds)
      .neq("status", "annule");

    const soldCounts: Record<string, number> = {};
    (matchTickets as any[])?.forEach((t: any) => {
      soldCounts[t.match_id] = (soldCounts[t.match_id] || 0) + 1;
    });

    matchIds.forEach((id: string) => {
      matchTicketStats[id] = { sold: soldCounts[id] || 0, total: catTotals[id] || 0 };
    });
  }

  // ── Last 5 expenses ──────────────────────────────────────────────
  let lastExpensesQuery = supabase
    .from("expenses")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  if (zoneFilter) lastExpensesQuery = lastExpensesQuery.eq("zone_id", zoneFilter);

  const { data: lastExpenses } = await lastExpensesQuery;

  // ── Revenue of last 5 terminated matches (donut) ──────────────────
  let last5Query = supabase
    .from("matches")
    .select("id, home_team, away_team, match_date")
    .eq("status", "termine")
    .order("match_date", { ascending: false })
    .limit(5);

  if (c3AccountId) last5Query = last5Query.eq("c3_account_id", c3AccountId);
  else if (zoneFilter) last5Query = last5Query.eq("zone_id", zoneFilter);

  const { data: last5Matches } = await last5Query;
  const last5MatchIds = last5Matches?.map((m: any) => m.id) || [];
  let last5Revenue: { id: string; teams: string; date: string; revenue: number }[] = [];

  if (last5MatchIds.length > 0) {
    const { data: l5Tickets } = await adminClient
      .from("tickets")
      .select("match_id, price")
      .in("match_id", last5MatchIds)
      .neq("status", "annule");

    const revMap: Record<string, number> = {};
    (l5Tickets as any[])?.forEach((t: any) => {
      revMap[t.match_id] = (revMap[t.match_id] || 0) + t.price;
    });

    last5Revenue = (last5Matches || []).map((m: any) => ({
      id: m.id,
      teams: `${m.home_team} vs ${m.away_team}`,
      date: m.match_date,
      revenue: revMap[m.id] || 0,
    }));
  }

  // ── Matches list for filter dropdown ─────────────────────────────
  let allMatchesQuery = supabase
    .from("matches")
    .select("id, home_team, away_team")
    .order("match_date", { ascending: false });
  if (c3AccountId) allMatchesQuery = allMatchesQuery.eq("c3_account_id", c3AccountId);
  else if (zoneFilter) allMatchesQuery = allMatchesQuery.eq("zone_id", zoneFilter);
  const { data: allMatchesList } = await allMatchesQuery;
  const filterMatches = (allMatchesList || []).map((m: any) => ({
    id: m.id,
    label: `${m.home_team} vs ${m.away_team}`,
  }));

  return (
    <div className="space-y-6">
      {profile.role === "super_admin" && selectedZone && <ZoneBackHeader zoneName={selectedZone.name} />}
      <h1 className="text-2xl font-bold font-heading">Tableau de bord</h1>

      <DashboardFilters matches={filterMatches} />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Billets vendus</p>
                <p className="text-2xl font-bold">{totalSold}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{periodLabel}</p>
              </div>
              <Ticket className="h-8 w-8 text-accent/60" />
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
                  <p className="text-xs text-orange-500 mt-0.5">−{formatFCFA(totalUnsoldValue)}</p>
                )}
              </div>
              <PackageX className="h-8 w-8 text-orange-400/60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Recettes</p>
                <p className="text-2xl font-bold text-brand">{formatFCFA(totalRevenue)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Billets vendus − Invendus</p>
              </div>
              <Banknote className="h-8 w-8 text-brand/40" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 7-day chart */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Ventes des 7 derniers jours</CardTitle></CardHeader>
        <CardContent><SalesChart data={chartData} /></CardContent>
      </Card>

      {last5Revenue.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center">
                <svg className="h-5 w-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
              </div>
              <div>
                <CardTitle className="text-lg">Recettes — 5 derniers matchs</CardTitle>
                <p className="text-sm text-muted-foreground">Vue d&apos;ensemble des recettes générées</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <RevenueDonut matches={last5Revenue} />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">Prochains matchs</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!upcomingMatches || upcomingMatches.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucun match à venir</p>
            ) : (
              upcomingMatches.map((match: any) => {
                const stats = matchTicketStats[match.id] || { sold: 0, total: 0 };
                const pct = stats.total > 0 ? (stats.sold / stats.total) * 100 : 0;
                return (
                  <div key={match.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{match.home_team} vs {match.away_team}</p>
                        <p className="text-xs text-muted-foreground">{formatDateShort(match.match_date)}</p>
                      </div>
                      <Badge variant="secondary" className={MATCH_STATUS_COLORS[match.status]}>
                        {MATCH_STATUS_LABELS[match.status]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={pct} className="flex-1" />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{stats.sold}/{stats.total}</span>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg">Dernières dépenses</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {!lastExpenses || lastExpenses.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucune dépense enregistrée</p>
            ) : (
              lastExpenses.map((expense: any) => (
                <div key={expense.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium text-sm">{expense.label}</p>
                    <p className="text-xs text-muted-foreground capitalize">{expense.category}</p>
                  </div>
                  <span className="font-bold text-danger text-sm">-{formatFCFA(expense.amount)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

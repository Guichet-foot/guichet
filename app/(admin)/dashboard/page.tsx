import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { getEffectiveZone } from "@/lib/get-effective-zone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Banknote, PackageX, Layers, ScanLine, Landmark, ReceiptText, MapPin, Link as LinkIcon } from "lucide-react";
import { formatFCFA, formatDateShort } from "@/lib/format";
import { fetchAll } from "@/lib/supabase/paginate";
import { MATCH_STATUS_LABELS, MATCH_STATUS_COLORS } from "@/lib/constants";
import { SalesChart } from "./sales-chart";
import { RevenueDonut } from "./revenue-donut";
import { DashboardFilters } from "./dashboard-filters";
import { ZoneCardGrid } from "@/components/zone-card-grid";
import { ZoneBackHeader } from "@/components/zone-back-header";
import { StatCard } from "./stat-card";
import { GlobalStatsChart } from "./global-stats-chart";
import { ZoneDonutChart } from "./zone-donut-chart";
import { ZonePerformanceTable } from "./zone-performance-table";
import { SecondaryIndicators } from "./secondary-indicators";
import { AutoRefresh } from "@/components/auto-refresh";
import type { ChartPoint } from "./global-stats-chart";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const metadata = { title: "Tableau de bord" };

// ── Period helpers ────────────────────────────────────────────────────────────

function parsePeriod(params: Record<string, string | undefined>) {
  const p = params.period || "30d";
  const now = new Date();
  // End-of-today: ensures matches scheduled later today are counted in Billets imprimés
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  let dateStart: Date;
  let dateEnd: Date = todayEnd;
  let periodLabel = "30 derniers jours";
  let periodDays = 30;

  switch (p) {
    case "today":
      dateStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      periodLabel = "Aujourd'hui";
      periodDays = 1;
      break;
    case "7d":
      dateStart = new Date(now.getTime() - 7 * 86_400_000);
      periodLabel = "7 derniers jours";
      periodDays = 7;
      break;
    case "month":
      dateStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodLabel = "Ce mois";
      periodDays = now.getDate();
      break;
    case "prevmonth": {
      dateStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      dateEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      periodLabel = "Mois précédent";
      periodDays  = dateEnd.getDate();
      break;
    }
    case "custom": {
      const s = params.start || "";
      const e = params.end || "";
      if (s && e) {
        dateStart = new Date(s + "T00:00:00");
        dateEnd   = new Date(e + "T23:59:59.999");
        const ms  = dateEnd.getTime() - dateStart.getTime();
        periodDays = Math.max(1, Math.round(ms / 86_400_000));
        periodLabel = `${formatDateShort(s)} – ${formatDateShort(e)}`;
        break;
      }
      // fallthrough to default
    }
    default:
      dateStart = new Date(now.getTime() - 30 * 86_400_000);
      periodLabel = "30 derniers jours";
      periodDays = 30;
  }

  const prevDateEnd   = new Date(dateStart.getTime() - 1);
  const prevDateStart = new Date(prevDateEnd.getTime() - periodDays * 86_400_000);

  return { dateStart, dateEnd, prevDateStart, prevDateEnd, periodLabel, periodDays };
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requireRole(["super_admin", "admin_zone", "c3", "president_odcav", "tresorier"]);
  const params  = await searchParams;

  const isOdcavRole = ["super_admin", "president_odcav", "tresorier"].includes(profile.role);

  const { effectiveZoneId, selectedZone, ownedZones, needsZoneSelection, c3AccountId } =
    await getEffectiveZone(profile, params.zone);

  // Zone grid for non-ODCAV roles that have multiple zones
  if (needsZoneSelection && !isOdcavRole) {
    return <ZoneCardGrid zones={ownedZones} title="Tableau de bord" />;
  }

  const adminClient = await createAdminClient();
  const { dateStart, dateEnd, prevDateStart, prevDateEnd, periodLabel } = parsePeriod(params);

  // ── ODCAV Global Dashboard ─────────────────────────────────────────────────
  if (isOdcavRole) {
    const zoneFilter = effectiveZoneId; // null = all zones

    // ODCAV isolation — build creatorIds (same pattern as finances/inter)
    const ownerId =
      (profile.role === "super_admin" || profile.role === "tresorier") && (profile as any).created_by_admin
        ? (profile as any).created_by_admin as string
        : profile.id;
    const { data: subAdminsData } = await adminClient
      .from("profiles").select("id, zone_id").eq("created_by_admin", ownerId);
    const subAdminList = (subAdminsData || []) as any[];
    const creatorIds = [ownerId, ...subAdminList.map((p: any) => p.id as string)];
    // Zone IDs managed by this ODCAV (from sub-admin zone assignments)
    const odcavZoneIds = new Set<string>(
      subAdminList.filter((p: any) => p.zone_id).map((p: any) => p.zone_id as string)
    );

    // 1. Zones list — only zones belonging to this ODCAV
    const { data: zonesData } = await adminClient.from("zones").select("id, name").order("name");
    const allZones = ((zonesData || []) as { id: string; name: string }[]).filter(
      (z) => odcavZoneIds.size === 0 || odcavZoneIds.has(z.id)
    );

    // 2. Matches in period — isolated to this ODCAV
    let matchQuery = adminClient
      .from("matches")
      .select("id, zone_id, home_team, away_team, match_date, status")
      .gte("match_date", dateStart.toISOString())
      .lte("match_date", dateEnd.toISOString())
      .in("created_by", creatorIds)
      .order("match_date", { ascending: false });
    if (zoneFilter) matchQuery = matchQuery.eq("zone_id", zoneFilter);
    const { data: matchesPeriod } = await matchQuery;
    const matchIds = (matchesPeriod || []).map((m: any) => m.id as string);

    // 3. Prev period matches (for trends) — isolated to this ODCAV
    let prevMatchQuery = adminClient
      .from("matches")
      .select("id")
      .gte("match_date", prevDateStart.toISOString())
      .lte("match_date", prevDateEnd.toISOString())
      .in("created_by", creatorIds);
    if (zoneFilter) prevMatchQuery = prevMatchQuery.eq("zone_id", zoneFilter);
    const { data: prevMatchesPeriod } = await prevMatchQuery;
    const prevMatchIds = (prevMatchesPeriod || []).map((m: any) => m.id as string);

    // 4. Tickets — current and previous periods in parallel
    const [allTickets, prevTickets] = await Promise.all([
      matchIds.length > 0
        ? fetchAll<any>((from, to) =>
            adminClient
              .from("tickets")
              .select("match_id, price, status, bloc_printed, counts_as_revenue")
              .in("match_id", matchIds)
              .range(from, to)
          )
        : Promise.resolve([]),
      prevMatchIds.length > 0
        ? fetchAll<any>((from, to) =>
            adminClient
              .from("tickets")
              .select("match_id, price, status, bloc_printed, counts_as_revenue")
              .in("match_id", prevMatchIds)
              .range(from, to)
          )
        : Promise.resolve([]),
    ]);

    // 5. Billeterie (global contribution only, no per-zone breakdown)
    let bilPrinted = 0, bilScanned = 0, bilRevenue = 0;
    if (matchIds.length > 0) {
      const matchIdSet = new Set(matchIds);
      const { data: allBils } = await adminClient.from("billeterie").select("id, price, match_ids");
      const bilsInPeriod = (allBils || []).filter((b: any) =>
        (b.match_ids || []).some((id: string) => matchIdSet.has(id))
      );
      const bilIds = bilsInPeriod.map((b: any) => b.id as string);
      const bilPriceMap: Record<string, number> = {};
      bilsInPeriod.forEach((b: any) => { bilPriceMap[b.id] = b.price || 0; });
      if (bilIds.length > 0) {
        // Fetch active tickets (for printed count) and ALL tickets (for revenue lookup)
        const [bilActiveTickets, bilAllTickets, scanData] = await Promise.all([
          fetchAll<any>((from, to) =>
            adminClient.from("billeterie_tickets").select("id, billeterie_id")
              .in("billeterie_id", bilIds).eq("withdrawn", false).range(from, to)
          ),
          fetchAll<any>((from, to) =>
            adminClient.from("billeterie_tickets").select("id, billeterie_id")
              .in("billeterie_id", bilIds).range(from, to)
          ),
          fetchAll<any>((from, to) =>
            adminClient.from("billeterie_scans").select("ticket_id, match_id")
              .in("match_id", matchIds).range(from, to)
          ),
        ]);
        bilPrinted = bilActiveTickets.length;
        // Build map from ALL tickets so a withdrawn/annulé ticket still generates revenue if scanned
        const bilTicketIdMap: Record<string, string> = {};
        bilAllTickets.forEach((t: any) => { bilTicketIdMap[t.id as string] = t.billeterie_id as string; });
        bilScanned = scanData.length;
        bilRevenue = scanData.reduce((s: number, sc: any) => {
          const bId = bilTicketIdMap[sc.ticket_id as string];
          return s + (bId ? bilPriceMap[bId] || 0 : 0);
        }, 0);
      }
    }

    // ── Aggregate global stats ──────────────────────────────────────────────
    const totalPrinted  = allTickets.filter((t: any) => t.bloc_printed).length + bilPrinted;
    const totalScanned  = allTickets.filter((t: any) => t.status === "scanne").length + bilScanned;
    const totalUnsold   = Math.max(0, totalPrinted - totalScanned);
    const grossRevenue  = allTickets
      .filter((t: any) => t.counts_as_revenue && t.status === "scanne")
      .reduce((s: number, t: any) => s + t.price, 0) + bilRevenue;

    // Prev period totals for trends
    const prevPrinted  = prevTickets.filter((t: any) => t.bloc_printed).length;
    const prevScanned  = prevTickets.filter((t: any) => t.status === "scanne").length;
    const prevRevenue  = prevTickets
      .filter((t: any) => t.counts_as_revenue && t.status === "scanne")
      .reduce((s: number, t: any) => s + t.price, 0);
    const prevUnsold   = Math.max(0, prevPrinted - prevScanned);

    const trendPrinted = prevPrinted > 0 ? ((totalPrinted - prevPrinted) / prevPrinted) * 100 : undefined;
    const trendUnsold  = prevUnsold  > 0 ? ((totalUnsold  - prevUnsold)  / prevUnsold)  * 100 : undefined;
    const trendRevenue = prevRevenue > 0 ? ((grossRevenue - prevRevenue)  / prevRevenue) * 100 : undefined;

    // ── Per-zone aggregation ────────────────────────────────────────────────
    const matchZoneMap: Record<string, string | null> = {};
    (matchesPeriod || []).forEach((m: any) => { matchZoneMap[m.id] = m.zone_id || null; });

    const zoneTicketsMap: Record<string, any[]> = {};
    allTickets.forEach((t: any) => {
      const zId = matchZoneMap[t.match_id] || "_inter";
      if (!zoneTicketsMap[zId]) zoneTicketsMap[zId] = [];
      zoneTicketsMap[zId].push(t);
    });

    const zonesForFilter = zoneFilter ? allZones.filter((z) => z.id === zoneFilter) : allZones;

    const zonePerformance = zonesForFilter.map((zone) => {
      const tickets = zoneTicketsMap[zone.id] || [];
      const matchesInZone = (matchesPeriod || []).filter((m: any) => m.zone_id === zone.id);
      const printed   = tickets.filter((t: any) => t.bloc_printed).length;
      const sold      = tickets.filter((t: any) => t.status === "scanne").length;
      const unsold    = Math.max(0, printed - sold);
      const revenue   = tickets
        .filter((t: any) => t.counts_as_revenue && t.status === "scanne")
        .reduce((s: number, t: any) => s + t.price, 0);
      return {
        id: zone.id, name: zone.name,
        printed, sold, unsold, revenue,
        matchCount: matchesInZone.length,
        unsoldRate: printed > 0 ? (unsold / printed) * 100 : 0,
      };
    }).filter((z) => z.matchCount > 0 || z.printed > 0);

    // Zones actives (zones with at least one match in period)
    const zonesActive = zoneFilter ? 1 : zonesForFilter.filter((z) =>
      (matchesPeriod || []).some((m: any) => m.zone_id === z.id)
    ).length;

    // ── Revenue by zone for donut ──────────────────────────────────────────
    const revenueByZone = zonePerformance
      .filter((z) => z.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .map((z) => ({
        id: z.id,
        name: z.name,
        revenue: z.revenue,
        pct: grossRevenue > 0 ? (z.revenue / grossRevenue) * 100 : 0,
      }));

    // ── Chart data (daily time series) ────────────────────────────────────
    const chartData: ChartPoint[] = [];
    {
      const cur = new Date(dateStart);
      cur.setHours(0, 0, 0, 0);
      const end = new Date(dateEnd);
      while (cur <= end) {
        const dayStr = cur.toISOString().split("T")[0];
        const dayMatchIds = new Set(
          (matchesPeriod || [])
            .filter((m: any) => m.match_date.startsWith(dayStr))
            .map((m: any) => m.id)
        );
        const dayTickets = allTickets.filter((t: any) => dayMatchIds.has(t.match_id));
        const printed  = dayTickets.filter((t: any) => t.bloc_printed).length;
        const scanned  = dayTickets.filter((t: any) => t.status === "scanne").length;
        const revenue  = dayTickets
          .filter((t: any) => t.counts_as_revenue && t.status === "scanne")
          .reduce((s: number, t: any) => s + t.price, 0);
        chartData.push({
          date: cur.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
          printed,
          unsold: Math.max(0, printed - scanned),
          revenue,
        });
        cur.setDate(cur.getDate() + 1);
      }
    }

    // Zone name map (for StatCard zone label)
    const zoneNameMap: Record<string, string> = {};
    allZones.forEach((z) => { zoneNameMap[z.id] = z.name; });

    const unsoldRate   = totalPrinted > 0 ? (totalUnsold / totalPrinted) * 100 : 0;
    const fraisODCAV   = Math.round(grossRevenue * 0.05);
    const fraisBil     = totalScanned * 10;

    // ── Render ───────────────────────────────────────────────────────────
    return (
      <div className="space-y-5 sm:space-y-6">
        <AutoRefresh intervalMs={15_000} />
        {/* Header */}
        {selectedZone && <ZoneBackHeader zoneName={selectedZone.name} />}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-heading">Tableau de bord</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{periodLabel}</p>
          </div>
        </div>

        {/* Filters */}
        <DashboardFilters
          zones={allZones}
          currentZone={zoneFilter || ""}
          showZoneFilter
        />

        {/* Stat cards — 4 cols on desktop, 2 on tablet, 1 on mobile */}
        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            title="Zones actives"
            value={zonesActive}
            subtitle={zoneFilter ? (zoneNameMap[zoneFilter] || "Zone sélectionnée") : "Toutes les zones"}
            icon={<MapPin className="h-5 w-5 text-brand" />}
            iconBg="bg-brand/10"
          />
          <StatCard
            title="Billets imprimés"
            value={totalPrinted.toLocaleString("fr-FR")}
            subtitle={`${Math.floor(totalPrinted / 100)} blocs imprimés`}
            icon={<Layers className="h-5 w-5 text-blue-600" />}
            iconBg="bg-blue-50"
            trend={trendPrinted}
          />
          <StatCard
            title="Billets invendus"
            value={totalUnsold.toLocaleString("fr-FR")}
            subtitle={`${unsoldRate.toFixed(1)}% des imprimés`}
            icon={<PackageX className="h-5 w-5 text-orange-600" />}
            iconBg="bg-orange-50"
            trend={trendUnsold}
          />
          <StatCard
            title="Recettes brutes"
            value={formatFCFA(grossRevenue)}
            subtitle="Avant frais ODCAV"
            icon={<Banknote className="h-5 w-5 text-emerald-600" />}
            iconBg="bg-emerald-50"
            trend={trendRevenue}
          />
        </div>

        {/* Frais summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-blue-200 bg-blue-50/40">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                <Landmark className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-blue-700 font-medium">Frais ODCAV (5%)</p>
                <p className="text-2xl font-bold text-blue-800 tabular-nums">{formatFCFA(fraisODCAV)}</p>
                <p className="text-xs text-blue-600">Sur recettes brutes</p>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-orange-200 bg-orange-50/40">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                <ReceiptText className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-orange-700 font-medium">Frais billetterie</p>
                <p className="text-2xl font-bold text-orange-800 tabular-nums">{formatFCFA(fraisBil)}</p>
                <p className="text-xs text-orange-600">{totalScanned.toLocaleString("fr-FR")} billets validés × 10 FCFA</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Secondary indicators */}
        <Card className="rounded-2xl shadow-sm border-border/40">
          <CardContent className="p-5 sm:p-6">
            <SecondaryIndicators
              data={{
                matchesPlayed: (matchesPeriod || []).filter((m: any) => m.status === "termine").length,
                ticketsSold: totalScanned,
                unsoldRate,
                totalRevenue: grossRevenue,
              }}
            />
          </CardContent>
        </Card>

        {/* Charts row — 2 cols on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
          <Card className="rounded-2xl shadow-sm border-border/40">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base sm:text-lg">Statistiques globales</CardTitle>
                <span className="text-xs text-muted-foreground hidden sm:block">{periodLabel}</span>
              </div>
            </CardHeader>
            <CardContent>
              <GlobalStatsChart data={chartData} />
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border-border/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-base sm:text-lg">Recettes par zone</CardTitle>
            </CardHeader>
            <CardContent>
              <ZoneDonutChart zones={revenueByZone} total={grossRevenue} />
            </CardContent>
          </Card>
        </div>

        {/* Zone performance table — full width */}
        <Card className="rounded-2xl shadow-sm border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg">Performances par zone</CardTitle>
          </CardHeader>
          <CardContent>
            <ZonePerformanceTable zones={zonePerformance} />
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Zone-specific Dashboard (admin_zone, c3, or ODCAV with zone) ───────────
  const zoneFilter = effectiveZoneId;

  // Legacy period parsing (backward compat with ?date, ?year, ?match)
  const filterMatchId = params.match || null;
  const filterDate    = params.date  || null;
  const filterYear    = params.year  || null;
  const todayStr      = new Date().toISOString().split("T")[0];

  let dateStart2: Date, dateEnd2: Date, periodLabel2: string;
  const periodParam = params.period;

  if (filterDate) {
    dateStart2 = new Date(filterDate + "T00:00:00");
    dateEnd2   = new Date(filterDate + "T23:59:59.999");
    periodLabel2 = filterDate === todayStr ? "Aujourd'hui" : `Le ${formatDateShort(filterDate)}`;
  } else if (filterYear) {
    dateStart2   = new Date(`${filterYear}-01-01T00:00:00`);
    dateEnd2     = new Date(`${filterYear}-12-31T23:59:59.999`);
    periodLabel2 = `Année ${filterYear}`;
  } else if (periodParam && periodParam !== "30d") {
    const p = parsePeriod(params);
    dateStart2   = p.dateStart;
    dateEnd2     = p.dateEnd;
    periodLabel2 = p.periodLabel;
  } else {
    // Use end-of-today so that matches scheduled later today are included
    // (billets must be printed before the match, so the match is always in the future)
    const n = new Date();
    dateEnd2   = new Date(n.getFullYear(), n.getMonth(), n.getDate(), 23, 59, 59, 999);
    dateStart2 = new Date(n.getTime() - 24 * 60 * 60 * 1000);
    periodLabel2 = "Dernières 24h";
  }

  let matchesPeriodQuery = adminClient.from("matches").select("id");
  if (filterMatchId) {
    matchesPeriodQuery = matchesPeriodQuery.eq("id", filterMatchId);
  } else {
    matchesPeriodQuery = matchesPeriodQuery
      .gte("match_date", dateStart2.toISOString())
      .lte("match_date", dateEnd2.toISOString());
  }
  if (c3AccountId)  matchesPeriodQuery = (matchesPeriodQuery as any).eq("c3_account_id", c3AccountId);
  else if (zoneFilter) matchesPeriodQuery = matchesPeriodQuery.eq("zone_id", zoneFilter);

  const { data: matchesPeriodData } = await matchesPeriodQuery;
  const matchIdsInPeriod = (matchesPeriodData || []).map((m: any) => m.id as string);

  let periodTickets: any[] = [];
  if (matchIdsInPeriod.length > 0) {
    periodTickets = await fetchAll<any>((from, to) =>
      adminClient.from("tickets")
        .select("price, status, bloc_printed, counts_as_revenue, match_id")
        .in("match_id", matchIdsInPeriod)
        .range(from, to)
    );
  }

  let bilPrinted = 0, bilScanned = 0, bilRevenue = 0;
  if (matchIdsInPeriod.length > 0) {
    const matchIdSet = new Set(matchIdsInPeriod);
    const { data: allBils } = await adminClient.from("billeterie").select("id, price, match_ids");
    const bilsInPeriod = (allBils || []).filter((b: any) =>
      (b.match_ids || []).some((id: string) => matchIdSet.has(id))
    );
    const bilIds = bilsInPeriod.map((b: any) => b.id as string);
    const bilPriceMap: Record<string, number> = {};
    bilsInPeriod.forEach((b: any) => { bilPriceMap[b.id] = b.price || 0; });
    if (bilIds.length > 0) {
      // Fetch active tickets (for printed count) and ALL tickets (for revenue lookup)
      const [bilActiveTickets, bilAllTickets, scanData] = await Promise.all([
        fetchAll<any>((from, to) =>
          adminClient.from("billeterie_tickets").select("id, billeterie_id")
            .in("billeterie_id", bilIds).neq("status", "annule").eq("withdrawn", false).range(from, to)
        ),
        fetchAll<any>((from, to) =>
          adminClient.from("billeterie_tickets").select("id, billeterie_id")
            .in("billeterie_id", bilIds).range(from, to)
        ),
        fetchAll<any>((from, to) =>
          adminClient.from("billeterie_scans").select("ticket_id")
            .in("match_id", matchIdsInPeriod).range(from, to)
        ),
      ]);
      bilPrinted = bilActiveTickets.length;
      // Use ALL tickets for revenue map so withdrawn/annulé tickets still count if scanned
      const bilTicketIdMap: Record<string, string> = {};
      bilAllTickets.forEach((t: any) => { bilTicketIdMap[t.id as string] = t.billeterie_id as string; });
      bilScanned = scanData.length;
      bilRevenue = scanData.reduce((s: number, sc: any) => {
        const bId = bilTicketIdMap[sc.ticket_id as string];
        return s + (bId ? bilPriceMap[bId] || 0 : 0);
      }, 0);
    }
  }

  const printedTickets  = periodTickets.filter((t: any) => t.bloc_printed === true);
  const totalPrinted    = printedTickets.length + bilPrinted;
  const totalBlocs      = Math.floor(totalPrinted / 100);
  const totalScanned    = periodTickets.filter((t: any) => t.status === "scanne").length + bilScanned;
  const totalUnsold     = Math.max(0, totalPrinted - totalScanned);
  const totalUnsoldValue = printedTickets
    .filter((t: any) => t.status !== "scanne")
    .reduce((s: number, t: any) => s + (t.price || 0), 0);
  const grossRevenue    = periodTickets
    .filter((t: any) => t.counts_as_revenue && t.status === "scanne")
    .reduce((s: number, t: any) => s + (t.price || 0), 0) + bilRevenue;
  const fraisODCAV      = Math.round(grossRevenue * 0.05);
  const fraisBilleterie = totalScanned * 10;

  // Upcoming matches
  const now = new Date().toISOString();
  let matchQuery2 = adminClient.from("matches").select("*")
    .gte("match_date", now).in("status", ["programme", "en_cours"])
    .order("match_date").limit(5);
  if (c3AccountId)   matchQuery2 = matchQuery2.eq("c3_account_id", c3AccountId);
  else if (zoneFilter) matchQuery2 = matchQuery2.eq("zone_id", zoneFilter);
  const { data: upcomingMatches } = await matchQuery2;

  // 7-day chart
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  const { data: weekRaw } = await adminClient.from("tickets")
    .select("price, sold_at, match_id, match:matches(zone_id, c3_account_id)")
    .gte("sold_at", sevenDaysAgo.toISOString())
    .lte("sold_at", new Date().toISOString())
    .neq("status", "annule");
  const filteredWeekTickets = ((c3AccountId
    ? weekRaw?.filter((t: any) => t.match?.c3_account_id === c3AccountId)
    : zoneFilter
    ? weekRaw?.filter((t: any) => t.match?.zone_id === zoneFilter)
    : weekRaw) || []) as any[];
  const chartData2: { date: string; ventes: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setDate(d.getDate() + i);
    const dayStr = d.toISOString().split("T")[0];
    const dayTotal = filteredWeekTickets
      .filter((t: any) => t.sold_at?.startsWith(dayStr))
      .reduce((sum: number, t: any) => sum + t.price, 0);
    chartData2.push({
      date: d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }),
      ventes: dayTotal,
    });
  }

  // Ticket stats for upcoming matches
  const matchIds2 = upcomingMatches?.map((m: any) => m.id) || [];
  const matchTicketStats: Record<string, { sold: number; total: number }> = {};
  if (matchIds2.length > 0) {
    const { data: cats } = await adminClient.from("ticket_categories")
      .select("match_id, quantity_total").in("match_id", matchIds2);
    const catTotals: Record<string, number> = {};
    (cats as any[])?.forEach((c: any) => {
      catTotals[c.match_id] = (catTotals[c.match_id] || 0) + c.quantity_total;
    });
    const { data: matchTickets } = await adminClient.from("tickets")
      .select("match_id").in("match_id", matchIds2).neq("status", "annule");
    const soldCounts: Record<string, number> = {};
    (matchTickets as any[])?.forEach((t: any) => {
      soldCounts[t.match_id] = (soldCounts[t.match_id] || 0) + 1;
    });
    matchIds2.forEach((id: string) => {
      matchTicketStats[id] = { sold: soldCounts[id] || 0, total: catTotals[id] || 0 };
    });
  }

  // Last 5 expenses
  let lastExpensesQuery = adminClient.from("expenses").select("*")
    .order("created_at", { ascending: false }).limit(5);
  if (zoneFilter) lastExpensesQuery = lastExpensesQuery.eq("zone_id", zoneFilter);
  const { data: lastExpenses } = await lastExpensesQuery;

  // Revenue donut (last 5 terminated matches)
  let last5Query = adminClient.from("matches")
    .select("id, home_team, away_team, match_date")
    .eq("status", "termine").order("match_date", { ascending: false }).limit(5);
  if (c3AccountId)   last5Query = last5Query.eq("c3_account_id", c3AccountId);
  else if (zoneFilter) last5Query = last5Query.eq("zone_id", zoneFilter);
  const { data: last5Matches } = await last5Query;
  const last5MatchIds = last5Matches?.map((m: any) => m.id) || [];
  let last5Revenue: { id: string; teams: string; date: string; revenue: number }[] = [];
  if (last5MatchIds.length > 0) {
    const { data: l5Tickets } = await adminClient.from("tickets")
      .select("match_id, price").in("match_id", last5MatchIds).neq("status", "annule");
    const revMap: Record<string, number> = {};
    (l5Tickets as any[])?.forEach((t: any) => { revMap[t.match_id] = (revMap[t.match_id] || 0) + t.price; });
    last5Revenue = (last5Matches || []).map((m: any) => ({
      id: m.id, teams: `${m.home_team} vs ${m.away_team}`, date: m.match_date, revenue: revMap[m.id] || 0,
    }));
  }

  // Match filter list
  let allMatchesQuery = adminClient.from("matches").select("id, home_team, away_team")
    .order("match_date", { ascending: false });
  if (c3AccountId)   allMatchesQuery = allMatchesQuery.eq("c3_account_id", c3AccountId);
  else if (zoneFilter) allMatchesQuery = allMatchesQuery.eq("zone_id", zoneFilter);
  const { data: allMatchesList } = await allMatchesQuery;
  const filterMatches = (allMatchesList || []).map((m: any) => ({
    id: m.id, label: `${m.home_team} vs ${m.away_team}`,
  }));

  return (
    <div className="space-y-5 sm:space-y-6">
      <AutoRefresh intervalMs={15_000} />
      {selectedZone && <ZoneBackHeader zoneName={selectedZone.name} />}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold font-heading">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{periodLabel2}</p>
      </div>

      <DashboardFilters matches={filterMatches} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Blocs imprimés" value={totalBlocs}
          subtitle={`${totalPrinted.toLocaleString("fr-FR")} billets au total`}
          icon={<Layers className="h-5 w-5 text-brand" />} iconBg="bg-brand/10" />
        <StatCard title="Validés par scan" value={totalScanned.toLocaleString("fr-FR")}
          subtitle={totalPrinted > 0 ? `${Math.round((totalScanned / totalPrinted) * 100)}% des imprimés` : "0% des imprimés"}
          icon={<ScanLine className="h-5 w-5 text-green-600" />} iconBg="bg-green-50" />
        <StatCard title="Invendus" value={totalUnsold.toLocaleString("fr-FR")}
          subtitle={totalUnsoldValue > 0 ? `−${formatFCFA(totalUnsoldValue)}` : undefined}
          icon={<PackageX className="h-5 w-5 text-orange-600" />} iconBg="bg-orange-50" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Recettes brutes" value={formatFCFA(grossRevenue)} subtitle="Avant frais"
          icon={<Banknote className="h-5 w-5 text-brand" />} iconBg="bg-brand/10" />
        <Card className="rounded-2xl border-blue-200 bg-blue-50/30">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700">Frais ODCAV (5%)</p>
              <p className="text-2xl font-bold text-blue-800 tabular-nums">{formatFCFA(fraisODCAV)}</p>
              <p className="text-xs text-blue-600 mt-0.5">Sur recettes brutes</p>
            </div>
            <Landmark className="h-8 w-8 text-blue-400/60" />
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-orange-200 bg-orange-50/30">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-700">Frais billetterie</p>
              <p className="text-2xl font-bold text-orange-800 tabular-nums">{formatFCFA(fraisBilleterie)}</p>
              <p className="text-xs text-orange-600 mt-0.5">{totalScanned.toLocaleString("fr-FR")} billets validés × 10 FCFA</p>
            </div>
            <ReceiptText className="h-8 w-8 text-orange-400/60" />
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader><CardTitle className="text-lg">Ventes des 7 derniers jours</CardTitle></CardHeader>
        <CardContent><SalesChart data={chartData2} /></CardContent>
      </Card>

      {last5Revenue.length > 0 && (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader><CardTitle className="text-lg">Recettes — 5 derniers matchs</CardTitle></CardHeader>
          <CardContent><RevenueDonut matches={last5Revenue} /></CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader><CardTitle className="text-lg">Prochains matchs</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!upcomingMatches || upcomingMatches.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucun match à venir</p>
            ) : (
              upcomingMatches.map((match: any) => {
                const stats = matchTicketStats[match.id] || { sold: 0, total: 0 };
                const pct   = stats.total > 0 ? (stats.sold / stats.total) * 100 : 0;
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
                    {stats.total > 0 && (
                      <div className="flex items-center gap-2">
                        <Progress value={pct} className="flex-1" />
                        <span className="text-xs text-muted-foreground">{stats.sold}/{stats.total}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm">
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

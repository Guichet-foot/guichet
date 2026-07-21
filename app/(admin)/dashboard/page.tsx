import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { getEffectiveZone } from "@/lib/get-effective-zone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Banknote, PackageX, Layers, ScanLine, Landmark, ReceiptText, Link as LinkIcon } from "lucide-react";
import { formatFCFA, formatDateShort } from "@/lib/format";
import { fetchAll } from "@/lib/supabase/paginate";
import { MATCH_STATUS_LABELS, MATCH_STATUS_COLORS } from "@/lib/constants";
import { SalesChart } from "./sales-chart";
import { RevenueDonut } from "./revenue-donut";
import { DashboardFilters } from "./dashboard-filters";
import { ZoneCardGrid } from "@/components/zone-card-grid";
import { ZoneBackHeader } from "@/components/zone-back-header";
import { StatCard } from "./stat-card";
import { ZoneDonutChart } from "./zone-donut-chart";
import { ZonePerformanceTable } from "./zone-performance-table";
import { AutoRefresh } from "@/components/auto-refresh";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const metadata = { title: "Tableau de bord" };

// ── Period helpers ────────────────────────────────────────────────────────────

function parsePeriod(params: Record<string, string | undefined>) {
  const p = params.period || "today";
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

    // super_admin and president_odcav see ALL data (no created_by filter)
    // tresorier is scoped to their parent's data
    const isGlobalRole = profile.role === "super_admin" || profile.role === "president_odcav";
    let creatorIds: string[] | null = null;
    if (!isGlobalRole) {
      const ownerId =
        profile.role === "tresorier" && (profile as any).created_by_admin
          ? (profile as any).created_by_admin as string
          : profile.id;
      const { data: subAdminsData } = await adminClient
        .from("profiles").select("id, zone_id").eq("created_by_admin", ownerId);
      creatorIds = [ownerId, ...((subAdminsData || []) as any[]).map((p: any) => p.id as string)];
    }

    // 1. All zones (global role sees all, restricted role filters by sub-admin zone assignments)
    const { data: zonesData } = await adminClient.from("zones").select("id, name").order("name");
    const allZones = (zonesData || []) as { id: string; name: string }[];

    // 2. Matches in period
    let matchQuery = adminClient
      .from("matches")
      .select("id, zone_id, home_team, away_team, match_date, status")
      .gte("match_date", dateStart.toISOString())
      .lte("match_date", dateEnd.toISOString())
      .order("match_date", { ascending: false });
    if (creatorIds) matchQuery = (matchQuery as any).in("created_by", creatorIds);
    if (zoneFilter) matchQuery = matchQuery.eq("zone_id", zoneFilter);
    const { data: matchesPeriod } = await matchQuery;
    const matchIds = (matchesPeriod || []).map((m: any) => m.id as string);

    // 3. Prev period matches (for trends)
    let prevMatchQuery = adminClient
      .from("matches")
      .select("id")
      .gte("match_date", prevDateStart.toISOString())
      .lte("match_date", prevDateEnd.toISOString());
    if (creatorIds) prevMatchQuery = (prevMatchQuery as any).in("created_by", creatorIds);
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

    // 5. Billeterie — tous matchs (zone + C3) pour découverte, scanned_at pour période
    let bilPrinted = 0, bilScanned = 0, bilRevenue = 0;
    {
      const { data: allBilsData } = await adminClient.from("billeterie").select("id, price, match_ids");
      const allBils = (allBilsData || []) as any[];

      // Tous les IDs C3 sans restriction created_by_admin
      const allC3MatchIdSet = new Set<string>();
      {
        const { data: c3Profiles } = await adminClient.from("profiles").select("id").eq("role", "c3");
        const c3Ids = ((c3Profiles || []) as any[]).map((p: any) => p.id as string);
        if (c3Ids.length > 0) {
          const { data: c3MatchData } = await adminClient.from("matches").select("id").in("c3_account_id", c3Ids);
          for (const m of (c3MatchData || []) as any[]) allC3MatchIdSet.add(m.id as string);
        }
      }

      // Billeteries liées aux matchs de la période OU aux matchs C3 (historiques compris)
      const matchIdSet = new Set(matchIds);
      const relevantBils = allBils.filter((b: any) =>
        (b.match_ids || []).some((id: string) => matchIdSet.has(id) || allC3MatchIdSet.has(id))
      );

      if (relevantBils.length > 0) {
        const relevantBilIds = relevantBils.map((b: any) => b.id as string);
        const bilPriceMap: Record<string, number> = {};
        relevantBils.forEach((b: any) => { bilPriceMap[b.id] = b.price || 0; });

        const allBilMatchIds = [...new Set(
          relevantBils.flatMap((b: any) => (b.match_ids || []) as string[])
        )];

        const [bilAllTickets, allBilScans] = await Promise.all([
          fetchAll<any>((from, to) =>
            adminClient.from("billeterie_tickets").select("id, billeterie_id, withdrawn")
              .in("billeterie_id", relevantBilIds).range(from, to)
          ),
          fetchAll<any>((from, to) =>
            adminClient.from("billeterie_scans").select("ticket_id, scanned_at")
              .in("match_id", allBilMatchIds).range(from, to)
          ),
        ]);

        const nonWithdrawnByBil: Record<string, number> = {};
        const bilTicketIdMap: Record<string, string> = {};
        bilAllTickets.forEach((t: any) => {
          bilTicketIdMap[t.id as string] = t.billeterie_id as string;
          if (!t.withdrawn) {
            nonWithdrawnByBil[t.billeterie_id] = (nonWithdrawnByBil[t.billeterie_id] || 0) + 1;
          }
        });

        const bilTicketIdSet = new Set(Object.keys(bilTicketIdMap));
        const relevantScans = allBilScans.filter((s: any) => bilTicketIdSet.has(s.ticket_id as string));

        const dateStartMs = dateStart.getTime();
        const dateEndMs   = dateEnd.getTime();

        const totalScansByBil: Record<string, number> = {};
        const periodScansByBil: Record<string, number> = {};
        relevantScans.forEach((s: any) => {
          const bId = bilTicketIdMap[s.ticket_id as string];
          if (!bId) return;
          totalScansByBil[bId] = (totalScansByBil[bId] || 0) + 1;
          const scannedAtMs = new Date(s.scanned_at as string).getTime();
          if (scannedAtMs >= dateStartMs && scannedAtMs <= dateEndMs) {
            periodScansByBil[bId] = (periodScansByBil[bId] || 0) + 1;
          }
        });

        bilPrinted = relevantBilIds.reduce((sum: number, bId: string) => {
          const nw = nonWithdrawnByBil[bId] || 0;
          const ts = totalScansByBil[bId] || 0;
          const ps = periodScansByBil[bId] || 0;
          return sum + Math.max(0, nw - (ts - ps));
        }, 0);

        const periodBilScans = relevantScans.filter((s: any) => {
          const scannedAtMs = new Date(s.scanned_at as string).getTime();
          return scannedAtMs >= dateStartMs && scannedAtMs <= dateEndMs;
        });
        bilScanned = periodBilScans.length;
        bilRevenue = periodBilScans.reduce((s: number, sc: any) => {
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

        {/* Stat cards — 2 cols tablet, 4 cols desktop */}
        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            title="Billets imprimés"
            value={totalPrinted.toLocaleString("fr-FR")}
            subtitle={`${Math.floor(totalPrinted / 100)} blocs imprimés`}
            icon={<Layers className="h-5 w-5 text-blue-600" />}
            iconBg="bg-blue-50"
            trend={trendPrinted}
          />
          <StatCard
            title="Validés par scan"
            value={totalScanned.toLocaleString("fr-FR")}
            subtitle={totalPrinted > 0 ? `${((totalScanned / totalPrinted) * 100).toFixed(1)}% des imprimés` : "0% des imprimés"}
            icon={<ScanLine className="h-5 w-5 text-green-600" />}
            iconBg="bg-green-50"
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

        {/* Chart — Recettes par zone */}
        <Card className="rounded-2xl shadow-sm border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg">Recettes par zone</CardTitle>
          </CardHeader>
          <CardContent>
            <ZoneDonutChart zones={revenueByZone} total={grossRevenue} />
          </CardContent>
        </Card>

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

  // C3 voit ses propres matchs + tous les matchs communaux is_direct (créés par les SA)
  let c3AllMatchIds: string[] | null = null;
  if (c3AccountId) {
    const [ownRes, communalRes] = await Promise.all([
      adminClient.from("matches").select("id").eq("c3_account_id", c3AccountId),
      adminClient.from("matches").select("id").eq("is_direct", true).eq("match_type", "Match Communal").is("c3_account_id", null),
    ]);
    c3AllMatchIds = [...new Set([
      ...(ownRes.data || []).map((m: any) => m.id as string),
      ...(communalRes.data || []).map((m: any) => m.id as string),
    ])];
  }
  const c3MatchIdSet = c3AllMatchIds ? new Set(c3AllMatchIds) : null;

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
  } else if (periodParam) {
    const p = parsePeriod(params);
    dateStart2   = p.dateStart;
    dateEnd2     = p.dateEnd;
    periodLabel2 = p.periodLabel;
  } else {
    const n = new Date();
    dateStart2   = new Date(n.getFullYear(), n.getMonth(), n.getDate(), 0, 0, 0, 0);
    dateEnd2     = new Date(n.getFullYear(), n.getMonth(), n.getDate(), 23, 59, 59, 999);
    periodLabel2 = "Aujourd'hui";
  }

  let matchesPeriodQuery = adminClient.from("matches").select("id");
  if (filterMatchId) {
    matchesPeriodQuery = matchesPeriodQuery.eq("id", filterMatchId);
  } else {
    matchesPeriodQuery = matchesPeriodQuery
      .gte("match_date", dateStart2.toISOString())
      .lte("match_date", dateEnd2.toISOString());
  }
  if (c3AllMatchIds !== null) {
    if (c3AllMatchIds.length > 0) matchesPeriodQuery = (matchesPeriodQuery as any).in("id", c3AllMatchIds);
    else matchesPeriodQuery = (matchesPeriodQuery as any).eq("id", "00000000-0000-0000-0000-000000000000");
  } else if (zoneFilter) matchesPeriodQuery = matchesPeriodQuery.eq("zone_id", zoneFilter);

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
  {
    // Pour les scans : utiliser TOUS les matchs C3 (pas seulement ceux de la période)
    // car le scan peut être attribué à un match antérieur encore en_cours via la chaîne.
    const scanMatchIds = c3AllMatchIds !== null ? c3AllMatchIds : matchIdsInPeriod;
    if (scanMatchIds.length > 0) {
      const scanMatchIdSet = new Set(scanMatchIds);
      const { data: allBils } = await adminClient.from("billeterie").select("id, price, match_ids");

      // Toutes les billeteries C3 (pour la couverture des scans)
      const allC3Bils = (allBils || []).filter((b: any) =>
        (b.match_ids || []).some((id: string) => scanMatchIdSet.has(id))
      );
      const allC3BilIds = allC3Bils.map((b: any) => b.id as string);
      const bilPriceMap: Record<string, number> = {};
      allC3Bils.forEach((b: any) => { bilPriceMap[b.id] = b.price || 0; });

      // Billeteries de la période uniquement → pour bilPrinted
      const periodMatchSet = new Set(matchIdsInPeriod);
      const bilsInPeriod = allC3Bils.filter((b: any) =>
        (b.match_ids || []).some((id: string) => periodMatchSet.has(id))
      );
      const periodBilIdSet = new Set(bilsInPeriod.map((b: any) => b.id as string));

      if (allC3BilIds.length > 0) {
        // Tous les match_ids de toutes les billeteries C3 → liste courte (~50 IDs max)
        const allBilMatchIds = [...new Set(
          allC3Bils.flatMap((b: any) => (b.match_ids || []) as string[])
        )];

        const [bilAllTickets, allBilScans] = await Promise.all([
          fetchAll<any>((from, to) =>
            adminClient.from("billeterie_tickets").select("id, billeterie_id, withdrawn")
              .in("billeterie_id", allC3BilIds).range(from, to)
          ),
          fetchAll<any>((from, to) =>
            adminClient.from("billeterie_scans").select("ticket_id, scanned_at")
              .in("match_id", allBilMatchIds).range(from, to)
          ),
        ]);

        const nonWithdrawnByBil: Record<string, number> = {};
        const bilTicketIdMap: Record<string, string> = {};
        bilAllTickets.forEach((t: any) => {
          bilTicketIdMap[t.id as string] = t.billeterie_id as string;
          if (!t.withdrawn) {
            nonWithdrawnByBil[t.billeterie_id] = (nonWithdrawnByBil[t.billeterie_id] || 0) + 1;
          }
        });

        const bilTicketIdSet = new Set(Object.keys(bilTicketIdMap));
        const relevantScans = allBilScans.filter((s: any) => bilTicketIdSet.has(s.ticket_id as string));

        const dateStartMs = dateStart2.getTime();
        const dateEndMs = dateEnd2.getTime();

        // Comptes totaux et période par billeterie (pour calcul bilPrinted)
        const totalScansByBil: Record<string, number> = {};
        const periodScansByBil: Record<string, number> = {};
        relevantScans.forEach((s: any) => {
          const bId = bilTicketIdMap[s.ticket_id as string];
          if (!bId) return;
          totalScansByBil[bId] = (totalScansByBil[bId] || 0) + 1;
          const scannedAtMs = new Date(s.scanned_at as string).getTime();
          if (scannedAtMs >= dateStartMs && scannedAtMs <= dateEndMs) {
            periodScansByBil[bId] = (periodScansByBil[bId] || 0) + 1;
          }
        });

        // bilPrinted = billets disponibles pour les billeteries de la période seulement
        bilPrinted = [...periodBilIdSet].reduce((sum: number, bId: string) => {
          const nw = nonWithdrawnByBil[bId] || 0;
          const ts = totalScansByBil[bId] || 0;
          const ps = periodScansByBil[bId] || 0;
          return sum + Math.max(0, nw - (ts - ps));
        }, 0);

        // bilScanned/bilRevenue = tous les scans de la période (toutes billeteries C3 confondues)
        const periodBilScans = relevantScans.filter((s: any) => {
          const scannedAtMs = new Date(s.scanned_at as string).getTime();
          return scannedAtMs >= dateStartMs && scannedAtMs <= dateEndMs;
        });
        bilScanned = periodBilScans.length;
        bilRevenue = periodBilScans.reduce((s: number, sc: any) => {
          const bId = bilTicketIdMap[sc.ticket_id as string];
          return s + (bId ? bilPriceMap[bId] || 0 : 0);
        }, 0);
      }
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
  if (c3AllMatchIds !== null) {
    if (c3AllMatchIds.length > 0) matchQuery2 = (matchQuery2 as any).in("id", c3AllMatchIds);
    else matchQuery2 = (matchQuery2 as any).eq("id", "00000000-0000-0000-0000-000000000000");
  } else if (zoneFilter) matchQuery2 = matchQuery2.eq("zone_id", zoneFilter);
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
  const filteredWeekTickets = ((c3MatchIdSet
    ? weekRaw?.filter((t: any) => c3MatchIdSet.has(t.match_id as string))
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
  if (c3AllMatchIds !== null) {
    if (c3AllMatchIds.length > 0) last5Query = (last5Query as any).in("id", c3AllMatchIds);
    else last5Query = (last5Query as any).eq("id", "00000000-0000-0000-0000-000000000000");
  } else if (zoneFilter) last5Query = last5Query.eq("zone_id", zoneFilter);
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
  if (c3AllMatchIds !== null) {
    if (c3AllMatchIds.length > 0) allMatchesQuery = (allMatchesQuery as any).in("id", c3AllMatchIds);
    else allMatchesQuery = (allMatchesQuery as any).eq("id", "00000000-0000-0000-0000-000000000000");
  } else if (zoneFilter) allMatchesQuery = allMatchesQuery.eq("zone_id", zoneFilter);
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

import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Wallet, Ticket, CalendarDays, Trophy } from "lucide-react";
import { formatFCFA } from "@/lib/format";
import { RevenueLineChart } from "./revenue-line-chart";
import { FondateurFilters } from "./fondateur-filters";
import { fetchAll } from "@/lib/supabase/paginate";
import { Suspense } from "react";
import { InterPdfButton } from "@/app/(admin)/finances/inter/pdf-button";

export const metadata = { title: "Dashboard Fondateur" };

/* eslint-disable @typescript-eslint/no-explicit-any */

const DEMO_ACCOUNT_ID = "aa984bd3-7493-41d3-bad0-7a9c733ba51e";

export default async function FondateurDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ sa?: string; date?: string; year?: string; chartFrom?: string; chartTo?: string; zone?: string; c3?: string }>;
}) {
  await requireRole(["fondateur"]);
  const params = await searchParams;
  const supabase = await createAdminClient();

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const selectedDate = params.date || params.chartFrom || today;

  // Year: explicit year filter OR year of selectedDate
  const selectedYear = params.year || selectedDate.substring(0, 4);
  const yearStart = `${selectedYear}-01-01T00:00:00`;
  const nextYearStart = `${String(parseInt(selectedYear) + 1)}-01-01T00:00:00`;

  // Month: if date/chartFrom → use that month; if year-only filter → use year + current month
  const selectedMonth = (params.date || params.chartFrom)
    ? selectedDate.substring(0, 7)
    : `${selectedYear}-${today.substring(5, 7)}`;

  // Date ranges for daily/monthly scan queries
  const todayStart = `${selectedDate}T00:00:00`;
  const nextDayObj = new Date(`${selectedDate}T12:00:00`);
  nextDayObj.setDate(nextDayObj.getDate() + 1);
  const tomorrowStart = `${nextDayObj.toISOString().split("T")[0]}T00:00:00`;
  const [smYear, smMonth] = selectedMonth.split("-").map(Number);
  const monthStart = `${selectedMonth}-01T00:00:00`;
  const nextMonthStart = `${smMonth === 12 ? smYear + 1 : smYear}-${String(smMonth === 12 ? 1 : smMonth + 1).padStart(2, "0")}-01T00:00:00`;

  // ── Phase 1: profiles, zones, matches, platform settings ─────────────────
  const [superAdminsRes, zonesRes, matchesRes, c3ProfilesRes] = await Promise.all([
    supabase.from("profiles").select("id, full_name").in("role", ["super_admin", "president_odcav"]),
    supabase.from("zones").select("id, name, created_by"),
    supabase.from("matches").select("id, match_date, zone_id, home_team_zone, away_team_zone, status, match_type, created_by, c3_account_id"),
    supabase.from("profiles").select("id, full_name").eq("role", "c3").order("full_name"),
  ]);

  const allSuperAdmins = (superAdminsRes.data || []) as { id: string; full_name: string }[];
  const superAdmins = allSuperAdmins.filter((sa) => sa.id !== DEMO_ACCOUNT_ID);
  const allZones = (zonesRes.data || []) as { id: string; name: string; created_by: string }[];
  const allC3Profiles = (c3ProfilesRes.data || []) as { id: string; full_name: string }[];
  const allMatchesRaw = (matchesRes.data || []) as any[];
  const allMatches = allMatchesRaw.filter((m: any) => m.status !== "annule") as any[];

  // Demo zone IDs
  const demoZoneIds = allZones.filter((z) => z.created_by === DEMO_ACCOUNT_ID).map((z) => z.id);
  const demoZoneIdsSet = new Set(demoZoneIds);
  // Demo match IDs from memory (no extra DB query)
  const demoMatchIds = allMatchesRaw
    .filter((m) => m.zone_id && demoZoneIdsSet.has(m.zone_id as string))
    .map((m) => m.id as string);

  // ── Scope: combine SA / Zone / C3 filters into one match ID set ─────────
  let scopeMatchIds: string[] | null = null;

  if (params.sa) {
    const saZoneIds = new Set(allZones.filter((z) => z.created_by === params.sa).map((z) => z.id));
    const ids = allMatches
      .filter((m) => m.zone_id ? saZoneIds.has(m.zone_id as string) : saZoneIds.has(m.home_team_zone as string) || saZoneIds.has(m.away_team_zone as string))
      .map((m) => m.id as string);
    scopeMatchIds = ids;
  }

  if (params.zone) {
    const zoneIds = new Set(
      allMatches
        .filter((m) => m.zone_id === params.zone || m.home_team_zone === params.zone || m.away_team_zone === params.zone)
        .map((m) => m.id as string)
    );
    scopeMatchIds = scopeMatchIds !== null
      ? scopeMatchIds.filter((id) => zoneIds.has(id))
      : [...zoneIds];
  }

  if (params.c3) {
    const c3Ids = new Set(
      allMatches.filter((m) => m.c3_account_id === params.c3).map((m) => m.id as string)
    );
    scopeMatchIds = scopeMatchIds !== null
      ? scopeMatchIds.filter((id) => c3Ids.has(id))
      : [...c3Ids];
  }

  function withScopeFilter(q: any): any {
    if (scopeMatchIds === null) return q;
    if (scopeMatchIds.length === 0) return q.eq("match_id", "00000000-0000-0000-0000-000000000000");
    return q.in("match_id", scopeMatchIds);
  }

  // ── Phase 2: scan counts (year-scoped + SA-scoped) ───────────────────────
  const [
    regularTicketsRes,
    regularScannedRes,
    bileterieTicketsRes,
    bilScansRes,
    todayBilScansRes,
    todayRegScansRes,
    monthBilScansRes,
    monthRegScansRes,
  ] = await Promise.all([
    supabase.from("tickets").select("*", { count: "exact", head: true }).neq("status", "annule"),
    withScopeFilter(supabase.from("tickets").select("id", { count: "exact", head: true }).eq("status", "scanne").eq("counts_as_revenue", true).gte("scanned_at", yearStart).lt("scanned_at", nextYearStart)),
    supabase.from("billeterie_tickets").select("*", { count: "exact", head: true }).eq("withdrawn", false),
    withScopeFilter(supabase.from("billeterie_scans").select("*", { count: "exact", head: true }).gte("scanned_at", yearStart).lt("scanned_at", nextYearStart)),
    withScopeFilter(supabase.from("billeterie_scans").select("*", { count: "exact", head: true }).gte("scanned_at", todayStart).lt("scanned_at", tomorrowStart)),
    withScopeFilter(supabase.from("tickets").select("id", { count: "exact", head: true }).eq("status", "scanne").eq("counts_as_revenue", true).gte("scanned_at", todayStart).lt("scanned_at", tomorrowStart)),
    withScopeFilter(supabase.from("billeterie_scans").select("*", { count: "exact", head: true }).gte("scanned_at", monthStart).lt("scanned_at", nextMonthStart)),
    withScopeFilter(supabase.from("tickets").select("id", { count: "exact", head: true }).eq("status", "scanne").eq("counts_as_revenue", true).gte("scanned_at", monthStart).lt("scanned_at", nextMonthStart)),
  ]);
  const totalBillets = (regularTicketsRes.count || 0) + (bileterieTicketsRes.count || 0);
  const totalBilScans = bilScansRes.count || 0;

  // ── Matches filter : demo exclusion → year → scope ───────────────────────
  // 1. Always strip demo account zones from billing
  let visibleMatches = allMatches.filter((m: any) =>
    !m.zone_id || !demoZoneIdsSet.has(m.zone_id as string)
  );

  // 2. Year filter
  if (params.year) {
    visibleMatches = visibleMatches.filter((m: any) =>
      (m.match_date as string | null)?.startsWith(params.year!)
    );
  }

  // 3. Entity scope filter (SA / Zone / C3 — unified)
  if (scopeMatchIds !== null) {
    const scopeSet = new Set(scopeMatchIds);
    visibleMatches = visibleMatches.filter((m: any) => scopeSet.has(m.id as string));
  }

  // ── Demo exclusion (skipped when SA filter applied — demo naturally excluded) ──
  let demoRegScanned = 0, demoBilScanned = 0;
  let demoDailyBil = 0, demoDailyReg = 0, demoMonthBil = 0, demoMonthReg = 0;

  if (demoMatchIds.length > 0 && scopeMatchIds === null) {
    const [dReg, dBil, dDayBil, dDayReg, dMonBil, dMonReg] = await Promise.all([
      supabase.from("tickets").select("id", { count: "exact", head: true }).eq("status", "scanne").eq("counts_as_revenue", true).in("match_id", demoMatchIds).gte("scanned_at", yearStart).lt("scanned_at", nextYearStart),
      supabase.from("billeterie_scans").select("id", { count: "exact", head: true }).in("match_id", demoMatchIds).gte("scanned_at", yearStart).lt("scanned_at", nextYearStart),
      supabase.from("billeterie_scans").select("*", { count: "exact", head: true }).in("match_id", demoMatchIds).gte("scanned_at", todayStart).lt("scanned_at", tomorrowStart),
      supabase.from("tickets").select("id", { count: "exact", head: true }).eq("status", "scanne").eq("counts_as_revenue", true).in("match_id", demoMatchIds).gte("scanned_at", todayStart).lt("scanned_at", tomorrowStart),
      supabase.from("billeterie_scans").select("*", { count: "exact", head: true }).in("match_id", demoMatchIds).gte("scanned_at", monthStart).lt("scanned_at", nextMonthStart),
      supabase.from("tickets").select("id", { count: "exact", head: true }).eq("status", "scanne").eq("counts_as_revenue", true).in("match_id", demoMatchIds).gte("scanned_at", monthStart).lt("scanned_at", nextMonthStart),
    ]);
    demoRegScanned = dReg.count || 0;
    demoBilScanned = dBil.count || 0;
    demoDailyBil = dDayBil.count || 0;
    demoDailyReg = dDayReg.count || 0;
    demoMonthBil = dMonBil.count || 0;
    demoMonthReg = dMonReg.count || 0;
  }

  // ── Per-organisateur breakdown for selected date ──────────────────────────
  const [dailyBilScansDetail, dailyRegScansDetail] = await Promise.all([
    fetchAll<{ match_id: string }>((from, to) =>
      withScopeFilter(
        supabase.from("billeterie_scans").select("match_id")
          .gte("scanned_at", todayStart).lt("scanned_at", tomorrowStart)
      ).range(from, to)
    ),
    fetchAll<{ match_id: string }>((from, to) =>
      withScopeFilter(
        supabase.from("tickets").select("match_id")
          .eq("status", "scanne").eq("counts_as_revenue", true)
          .gte("scanned_at", todayStart).lt("scanned_at", tomorrowStart)
      ).range(from, to)
    ),
  ]);

  // Build match → zone/c3 lookup from already-fetched allMatches
  const matchMetaMap: Record<string, { zone_id: string | null; c3_id: string | null }> = {};
  allMatches.forEach((m: any) => {
    matchMetaMap[m.id as string] = {
      zone_id: (m.zone_id as string | null) ?? null,
      c3_id: (m.c3_account_id as string | null) ?? null,
    };
  });

  const zoneScansDay: Record<string, number> = {};
  const c3ScansDay: Record<string, number> = {};

  const accumulateDayScans = (rows: { match_id: string }[]) => {
    rows.forEach((s) => {
      const meta = matchMetaMap[s.match_id];
      if (!meta) return;
      if (meta.zone_id && !demoZoneIdsSet.has(meta.zone_id)) {
        zoneScansDay[meta.zone_id] = (zoneScansDay[meta.zone_id] || 0) + 1;
      } else if (!meta.zone_id && meta.c3_id && meta.c3_id !== DEMO_ACCOUNT_ID) {
        c3ScansDay[meta.c3_id] = (c3ScansDay[meta.c3_id] || 0) + 1;
      }
    });
  };
  accumulateDayScans(dailyBilScansDetail);
  accumulateDayScans(dailyRegScansDetail);

  const zoneNameMap: Record<string, string> = {};
  allZones.forEach((z) => { zoneNameMap[z.id] = z.name; });
  const c3NameMap: Record<string, string> = {};
  allC3Profiles.forEach((c) => { c3NameMap[c.id] = c.full_name; });

  type OrgEntry = { type: "zone" | "c3"; name: string; scans: number; frais: number };
  const orgListDay: OrgEntry[] = [
    ...Object.entries(zoneScansDay).map(([id, scans]): OrgEntry => ({
      type: "zone", name: zoneNameMap[id] || id, scans, frais: scans * 10,
    })),
    ...Object.entries(c3ScansDay).map(([id, scans]): OrgEntry => ({
      type: "c3", name: c3NameMap[id] || id, scans, frais: scans * 10,
    })),
  ].sort((a, b) => b.scans - a.scans);

  // ── Revenue cards (scans × 10 FCFA — même modèle pour les 3 cartes) ──────
  const totalAllScanned = (regularScannedRes.count || 0) + totalBilScans;
  const totalNonDemoScanned = Math.max(0, totalAllScanned - demoRegScanned - demoBilScanned);
  const revenusTotal = totalNonDemoScanned * 10;

  const dailyNonDemo = Math.max(0, (todayBilScansRes.count || 0) + (todayRegScansRes.count || 0) - demoDailyBil - demoDailyReg);
  const monthNonDemo = Math.max(0, (monthBilScansRes.count || 0) + (monthRegScansRes.count || 0) - demoMonthBil - demoMonthReg);
  const revenusJournaliers = dailyNonDemo * 10;
  const revenusMensuel = monthNonDemo * 10;

  // Total matches count (visible scope)
  const matchesCount = allMatches.length;
  const visibleMatchesCount = visibleMatches.length;

  // ── 12-month revenue chart (scans × 10 FCFA par mois) ───────────────────
  const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

  const monthRanges = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const nextD = new Date(now.getFullYear(), now.getMonth() - (11 - i) + 1, 1);
    return {
      label: `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`,
      start: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01T00:00:00`,
      end: `${nextD.getFullYear()}-${String(nextD.getMonth() + 1).padStart(2, "0")}-01T00:00:00`,
    };
  });

  const monthScanCounts = await Promise.all(
    monthRanges.map(async ({ start, end }) => {
      const [bilRes, regRes] = await Promise.all([
        withScopeFilter(
          supabase.from("billeterie_scans").select("*", { count: "exact", head: true })
            .gte("scanned_at", start).lt("scanned_at", end)
        ),
        withScopeFilter(
          supabase.from("tickets").select("id", { count: "exact", head: true })
            .eq("status", "scanne").eq("counts_as_revenue", true)
            .gte("scanned_at", start).lt("scanned_at", end)
        ),
      ]);
      let total = (bilRes.count || 0) + (regRes.count || 0);
      if (demoMatchIds.length > 0 && scopeMatchIds === null) {
        const [dBil, dReg] = await Promise.all([
          supabase.from("billeterie_scans").select("*", { count: "exact", head: true })
            .in("match_id", demoMatchIds).gte("scanned_at", start).lt("scanned_at", end),
          supabase.from("tickets").select("id", { count: "exact", head: true })
            .eq("status", "scanne").in("match_id", demoMatchIds)
            .gte("scanned_at", start).lt("scanned_at", end),
        ]);
        total = Math.max(0, total - (dBil.count || 0) - (dReg.count || 0));
      }
      return total;
    })
  );

  const revenueChartData = monthRanges.map(({ label }, idx) => ({
    month: label,
    revenue: monthScanCounts[idx] * 10,
  }));

  // ── Filter lists for UI ──────────────────────────────────────────────────
  const filterSAList = superAdmins.map((s) => ({ id: s.id, name: s.full_name }));
  const filterZoneList = allZones.map((z) => ({ id: z.id, name: z.name }));
  const filterC3List = allC3Profiles.map((c) => ({ id: c.id, name: c.full_name }));

  const dateLabel = new Date(selectedDate + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  const monthLabel = `${monthNames[parseInt(selectedMonth.split("-")[1]) - 1]} ${selectedMonth.split("-")[0]}`;

  // Derive PDF date range from active filters
  const pdfFrom = params.date || (params.year ? `${params.year}-01-01` : undefined);
  const pdfTo = params.date || (params.year ? `${params.year}-12-31` : undefined);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold font-heading">Dashboard Fondateur</h1>
        <InterPdfButton from={pdfFrom} to={pdfTo} />
      </div>

      <Suspense>
        <FondateurFilters
          superAdmins={filterSAList}
          zones={filterZoneList}
          c3Accounts={filterC3List}
        />
      </Suspense>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-700 font-medium">Revenus journaliers</p>
                <p className="text-2xl font-bold text-blue-800">{formatFCFA(revenusJournaliers)}</p>
                <p className="text-[11px] text-blue-600 mt-0.5">
                  {dateLabel} · {dailyNonDemo} scan{dailyNonDemo !== 1 ? "s" : ""} × 10 FCFA
                </p>
              </div>
              <CalendarDays className="h-8 w-8 text-blue-300" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-700 font-medium">Revenus mensuel</p>
                <p className="text-2xl font-bold text-amber-800">{formatFCFA(revenusMensuel)}</p>
                <p className="text-[11px] text-amber-600 mt-0.5">
                  {monthLabel} · {monthNonDemo} scan{monthNonDemo !== 1 ? "s" : ""} × 10 FCFA
                </p>
              </div>
              <Wallet className="h-8 w-8 text-amber-300" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-200 col-span-2 lg:col-span-1">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-700 font-medium">Revenus totaux</p>
                <p className="text-2xl font-bold text-green-800">{formatFCFA(revenusTotal)}</p>
                <p className="text-[11px] text-green-600 mt-0.5">{selectedYear} · {totalNonDemoScanned.toLocaleString("fr-FR")} billets × 10 FCFA</p>
              </div>
              <Trophy className="h-8 w-8 text-green-300" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Zones</p>
                <p className="text-2xl font-bold">{allZones.length}</p>
              </div>
              <MapPin className="h-7 w-7 text-brand/30" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Matchs</p>
                <p className="text-2xl font-bold">{params.sa ? visibleMatchesCount : matchesCount}</p>
              </div>
              <Trophy className="h-7 w-7 text-brand/30" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Billets</p>
                <p className="text-2xl font-bold">{totalBillets}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{totalBilScans} scannés</p>
              </div>
              <Ticket className="h-7 w-7 text-brand/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Revenue line chart — 12 months ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Revenus frais plateforme — 12 derniers mois</CardTitle>
        </CardHeader>
        <CardContent>
          <RevenueLineChart data={revenueChartData} />
        </CardContent>
      </Card>

      {/* ── Organisateurs actifs — frais du jour ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Organisateurs actifs — {dateLabel}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {orgListDay.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucun scan enregistré le {dateLabel}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left px-4 py-2 font-medium">Organisateur</th>
                    <th className="text-left px-4 py-2 font-medium hidden sm:table-cell">Type</th>
                    <th className="text-right px-4 py-2 font-medium">Scans</th>
                    <th className="text-right px-4 py-2 font-medium">Frais billetterie</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orgListDay.map((org, i) => (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-medium">{org.name}</td>
                      <td className="px-4 py-2.5 hidden sm:table-cell">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          org.type === "zone"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                        }`}>
                          {org.type === "zone" ? "Zone" : "C3"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {org.scans.toLocaleString("fr-FR")}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-bold text-brand">
                        {formatFCFA(org.frais)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/30 text-sm font-bold">
                    <td className="px-4 py-2.5" colSpan={2}>Total</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {orgListDay.reduce((s, o) => s + o.scans, 0).toLocaleString("fr-FR")}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-brand">
                      {formatFCFA(orgListDay.reduce((s, o) => s + o.frais, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}

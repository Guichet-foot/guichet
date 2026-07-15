import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Wallet, Ticket, CalendarDays, Trophy } from "lucide-react";
import { formatFCFA } from "@/lib/format";
import { RevenueLineChart } from "./revenue-line-chart";
import { FraisPlateformeChart } from "./frais-plateforme-chart";
import { FondateurFilters } from "./fondateur-filters";
import { Suspense } from "react";

export const metadata = { title: "Dashboard Fondateur" };

/* eslint-disable @typescript-eslint/no-explicit-any */

const DEMO_ACCOUNT_ID = "aa984bd3-7493-41d3-bad0-7a9c733ba51e";

export default async function FondateurDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ sa?: string; date?: string; year?: string; chartFrom?: string; chartTo?: string }>;
}) {
  await requireRole(["fondateur"]);
  const params = await searchParams;
  const supabase = await createAdminClient();

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const selectedDate = params.date || today;
  const selectedMonth = selectedDate.substring(0, 7);

  // Date ranges for daily/monthly scan queries
  const todayStart = `${selectedDate}T00:00:00`;
  const nextDayObj = new Date(`${selectedDate}T12:00:00`);
  nextDayObj.setDate(nextDayObj.getDate() + 1);
  const tomorrowStart = `${nextDayObj.toISOString().split("T")[0]}T00:00:00`;
  const [smYear, smMonth] = selectedMonth.split("-").map(Number);
  const monthStart = `${selectedMonth}-01T00:00:00`;
  const nextMonthStart = `${smMonth === 12 ? smYear + 1 : smYear}-${String(smMonth === 12 ? 1 : smMonth + 1).padStart(2, "0")}-01T00:00:00`;

  // ── Fetch everything in parallel ─────────────────────────────────────────
  const [
    superAdminsRes,
    zonesRes,
    regularTicketsRes,
    regularScannedRes,
    bileterieTicketsRes,
    bilScansRes,
    matchesRes,
    platformSettingsRes,
    todayBilScansRes,
    todayRegScansRes,
    monthBilScansRes,
    monthRegScansRes,
  ] = await Promise.all([
    supabase.from("profiles").select("id, full_name").in("role", ["super_admin", "president_odcav"]),
    supabase.from("zones").select("id, name, created_by"),
    supabase.from("tickets").select("*", { count: "exact", head: true }).neq("status", "annule"),
    supabase.from("tickets").select("id", { count: "exact", head: true }).eq("status", "scanne").eq("counts_as_revenue", true),
    supabase.from("billeterie_tickets").select("*", { count: "exact", head: true }).eq("withdrawn", false),
    supabase.from("billeterie_scans").select("*", { count: "exact", head: true }),
    supabase.from("matches").select("id, match_date, zone_id, home_team_zone, away_team_zone, status, match_type, created_by"),
    supabase.from("platform_settings").select("fee_per_block, effective_date").order("effective_date", { ascending: true }),
    supabase.from("billeterie_scans").select("*", { count: "exact", head: true }).gte("scanned_at", todayStart).lt("scanned_at", tomorrowStart),
    supabase.from("tickets").select("id", { count: "exact", head: true }).eq("status", "scanne").eq("counts_as_revenue", true).gte("scanned_at", todayStart).lt("scanned_at", tomorrowStart),
    supabase.from("billeterie_scans").select("*", { count: "exact", head: true }).gte("scanned_at", monthStart).lt("scanned_at", nextMonthStart),
    supabase.from("tickets").select("id", { count: "exact", head: true }).eq("status", "scanne").eq("counts_as_revenue", true).gte("scanned_at", monthStart).lt("scanned_at", nextMonthStart),
  ]);

  const allSuperAdmins = (superAdminsRes.data || []) as { id: string; full_name: string }[];
  // Exclure le compte démo des calculs et de l'affichage
  const superAdmins = allSuperAdmins.filter((sa) => sa.id !== DEMO_ACCOUNT_ID);
  const allZones = (zonesRes.data || []) as { id: string; name: string; created_by: string }[];
  const totalBillets = (regularTicketsRes.count || 0) + (bileterieTicketsRes.count || 0);
  const totalBilScans = bilScansRes.count || 0;
  const allMatches = (matchesRes.data || []).filter((m: any) => m.status !== "annule") as any[];
  const platformHistory = (platformSettingsRes.data || []) as { fee_per_block: number; effective_date: string }[];

  // ── Platform fee helper ───────────────────────────────────────────────────
  function getFraisForDate(dateStr: string): number {
    let frais = 1000; // default fallback (fee_per_block)
    for (const row of platformHistory) {
      if (row.effective_date <= dateStr) frais = row.fee_per_block ?? 1000;
      else break;
    }
    return frais;
  }

  // ── Demo zone IDs (computed early, used for billing exclusion + scan subtraction) ──
  const demoZoneIds = allZones.filter((z) => z.created_by === DEMO_ACCOUNT_ID).map((z) => z.id);
  const demoZoneIdsSet = new Set(demoZoneIds);

  // ── Matches filter : demo exclusion → year → SA ───────────────────────────
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

  // 3. SA filter
  if (params.sa) {
    const saZoneIds = new Set(allZones.filter((z) => z.created_by === params.sa).map((z) => z.id));
    visibleMatches = visibleMatches.filter((m: any) => {
      if (m.zone_id) return saZoneIds.has(m.zone_id as string);
      return saZoneIds.has(m.home_team_zone as string) || saZoneIds.has(m.away_team_zone as string);
    });
  }

  // ── Core revenue engine ───────────────────────────────────────────────────
  // For each match we determine the "billing units" (zone-days).
  // Zone match    → 1 zone per day  (zone_id)
  // ODCAV match   → home + away zones per day (if known), else 1 unit (match.id as proxy)
  // This ensures ODCAV matches always generate revenue even if zone fields are null.

  function getBillingUnitsForMatch(m: any): string[] {
    if (m.zone_id) return [m.zone_id as string];
    const units: string[] = [];
    if (m.home_team_zone) units.push(m.home_team_zone as string);
    if (m.away_team_zone) units.push(m.away_team_zone as string);
    // Fallback: ODCAV match with no zone info → count as 1 unit using match id
    if (units.length === 0) units.push(`match:${m.id as string}`);
    return units;
  }

  // Build map: dayStr → Set<billingUnit>
  function buildBillingByDay(matches: any[]): Map<string, Set<string>> {
    const byDay = new Map<string, Set<string>>();
    for (const m of matches) {
      if (!m.match_date) continue;
      const day = (m.match_date as string).split("T")[0];
      if (!byDay.has(day)) byDay.set(day, new Set());
      for (const unit of getBillingUnitsForMatch(m)) {
        byDay.get(day)!.add(unit);
      }
    }
    return byDay;
  }

  const billingByDay = buildBillingByDay(visibleMatches);

  // ── Demo exclusion (total + daily + monthly) ──────────────────────────────
  let demoRegScanned = 0, demoBilScanned = 0;
  let demoDailyBil = 0, demoDailyReg = 0, demoMonthBil = 0, demoMonthReg = 0;

  if (demoZoneIds.length > 0) {
    const { data: demoMatchData } = await supabase.from("matches").select("id").in("zone_id", demoZoneIds);
    const demoMatchIds = (demoMatchData || []).map((m: any) => m.id as string);
    if (demoMatchIds.length > 0) {
      const [dReg, dBil, dDayBil, dDayReg, dMonBil, dMonReg] = await Promise.all([
        supabase.from("tickets").select("id", { count: "exact", head: true }).eq("status", "scanne").eq("counts_as_revenue", true).in("match_id", demoMatchIds),
        supabase.from("billeterie_scans").select("id", { count: "exact", head: true }).in("match_id", demoMatchIds),
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
  }

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

  // ── 12-month revenue chart ────────────────────────────────────────────────
  const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  const revenueChartData: { month: string; revenue: number }[] = [];

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthLabel = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`;
    let monthRevenue = 0;
    const seenPairs = new Set<string>();
    for (const [dayStr, units] of billingByDay) {
      if (!dayStr.startsWith(monthKey)) continue;
      for (const unit of units) {
        const key = `${unit}|${dayStr}`;
        if (!seenPairs.has(key)) {
          seenPairs.add(key);
          monthRevenue += getFraisForDate(dayStr);
        }
      }
    }
    revenueChartData.push({ month: monthLabel, revenue: monthRevenue });
  }

  // ── Daily platform chart (last 15 days by default) ───────────────────────
  const defaultChartTo = today;
  const defaultChartFrom = (() => {
    const d = new Date(now);
    d.setDate(d.getDate() - 14);
    return d.toISOString().split("T")[0];
  })();
  const chartFrom = params.chartFrom || defaultChartFrom;
  const chartTo = params.chartTo || defaultChartTo;

  const dailyPlatformData: { date: string; label: string; revenue: number }[] = [];
  const chartCursor = new Date(chartFrom + "T12:00:00");
  const chartEnd = new Date(chartTo + "T12:00:00");
  while (chartCursor <= chartEnd) {
    const dayStr = chartCursor.toISOString().split("T")[0];
    const label = chartCursor.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
    const units = billingByDay.get(dayStr) || new Set<string>();
    dailyPlatformData.push({ date: dayStr, label, revenue: units.size * getFraisForDate(dayStr) });
    chartCursor.setDate(chartCursor.getDate() + 1);
  }

  // ── Super admin list (for filter UI) ────────────────────────────────────
  const filterSAList = superAdmins.map((s) => ({ id: s.id, name: s.full_name }));

  const dateLabel = new Date(selectedDate + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  const monthLabel = `${monthNames[parseInt(selectedMonth.split("-")[1]) - 1]} ${selectedMonth.split("-")[0]}`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-heading">Dashboard Fondateur</h1>

      <Suspense>
        <FondateurFilters superAdmins={filterSAList} />
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
                <p className="text-[11px] text-green-600 mt-0.5">{totalNonDemoScanned.toLocaleString("fr-FR")} billets scannés × 10 FCFA</p>
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

      {/* ── Daily platform chart ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <CardTitle className="text-base">Recettes journalières — Frais Plateforme</CardTitle>
            <p className="text-xs text-muted-foreground">
              {new Date(chartFrom + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
              {" → "}
              {new Date(chartTo + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <FraisPlateformeChart data={dailyPlatformData} />
        </CardContent>
      </Card>

    </div>
  );
}

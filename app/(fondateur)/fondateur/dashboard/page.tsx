import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MapPin, Wallet, Ticket, CalendarDays } from "lucide-react";
import { formatFCFA } from "@/lib/format";
import { RevenueLineChart } from "./revenue-line-chart";
import { FraisPlateformeChart } from "./frais-plateforme-chart";
import { FondateurFilters } from "./fondateur-filters";
import Link from "next/link";

export const metadata = { title: "Dashboard Fondateur" };

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function FondateurDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; sa?: string; date?: string; chartFrom?: string; chartTo?: string }>;
}) {
  const profile = await requireRole(["fondateur"]);
  const params = await searchParams;
  const supabase = await createAdminClient();

  const { data: superAdmins } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "super_admin")
    .eq("created_by_admin", profile.id);

  const { count: zonesCount } = await supabase
    .from("zones")
    .select("*", { count: "exact", head: true });

  // Count all billets across both tables (bloc-printed tickets have counts_as_revenue=false
  // before being scanned, so we can't use that filter — count by status instead)
  const [
    { count: regularTicketsCount },
    { count: bileterieTicketsCount },
    { count: bilScansCount },
  ] = await Promise.all([
    supabase.from("tickets").select("*", { count: "exact", head: true }).neq("status", "annule"),
    supabase.from("billeterie_tickets").select("*", { count: "exact", head: true }).eq("withdrawn", false),
    supabase.from("billeterie_scans").select("*", { count: "exact", head: true }),
  ]);
  const totalBillets = (regularTicketsCount || 0) + (bileterieTicketsCount || 0);
  const totalBilScans = bilScansCount || 0;

  // For platform fee calculations, still use the tickets table with match_date
  // (zone-based activity only — ODCAV matches have zone_id=null and don't generate fees)
  const { data: allTickets } = await supabase
    .from("tickets")
    .select("price, match:matches(zone_id, match_date)")
    .neq("status", "annule") as { data: any[] | null };

  let filteredTickets = allTickets || [];

  if (params.year) {
    filteredTickets = filteredTickets.filter((t: any) => t.match?.match_date?.startsWith(params.year));
  }

  if (params.sa) {
    const { data: saZones } = await supabase.from("zones").select("id").eq("created_by", params.sa);
    const saZoneIds = new Set(saZones?.map((z: any) => z.id) || []);
    filteredTickets = filteredTickets.filter((t: any) => saZoneIds.has(t.match?.zone_id));
  }

  const { count: matchesCount } = await supabase
    .from("matches")
    .select("*", { count: "exact", head: true });

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const selectedDate = params.date || today;

  // Charger tout l'historique des frais plateforme pour appliquer le bon tarif par jour
  const { data: allPlatformSettings } = await supabase
    .from("platform_settings")
    .select("frais_plateforme, effective_date")
    .order("effective_date", { ascending: true });
  const platformHistory = (allPlatformSettings || []) as { frais_plateforme: number; effective_date: string }[];

  // Retourne le frais en vigueur à une date donnée (évite la rétroactivité)
  function getFraisForDate(dateStr: string): number {
    let frais = 5000;
    for (const row of platformHistory) {
      if (row.effective_date <= dateStr) frais = row.frais_plateforme;
      else break;
    }
    return frais;
  }

  const fraisPlateforme = getFraisForDate(selectedDate);

  // Tickets filtrés par super admin uniquement (sans le filtre date/année) pour les calculs de revenus plateforme
  let saFilteredTickets = allTickets || [];
  if (params.sa) {
    const { data: saZones } = await supabase.from("zones").select("id").eq("created_by", params.sa);
    const saZoneIds = new Set(saZones?.map((z: any) => z.id) || []);
    saFilteredTickets = saFilteredTickets.filter((t: any) => saZoneIds.has(t.match?.zone_id));
  }

  // Revenus journaliers = zones actives ce jour-là × frais en vigueur ce jour-là
  // Utilise match_date (pas sold_at qui est null pour les billets bloc)
  const dailyActiveZones = new Set(
    saFilteredTickets
      .filter((t: any) => t.match?.match_date?.startsWith(selectedDate) && t.match?.zone_id)
      .map((t: any) => t.match.zone_id)
  );
  const revenusJournaliers = dailyActiveZones.size * fraisPlateforme;

  // Revenus mensuel = somme par (zone, jour de match) × frais en vigueur ce jour-là
  const selectedMonth = selectedDate.substring(0, 7);
  let revenusMensuel = 0;
  {
    const seenPairs = new Set<string>();
    for (const t of saFilteredTickets) {
      if (!t.match?.match_date?.startsWith(selectedMonth) || !t.match?.zone_id) continue;
      const dayStr = t.match.match_date.split("T")[0];
      const key = `${t.match.zone_id}|${dayStr}`;
      if (!seenPairs.has(key)) {
        seenPairs.add(key);
        revenusMensuel += getFraisForDate(dayStr);
      }
    }
  }

  // Revenue line chart — 12 derniers mois, frais historiques par jour
  const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  const revenueChartData: { month: string; revenue: number }[] = [];

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthLabel = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`;
    const activePairsByDay = new Map<string, Set<string>>();
    for (const t of saFilteredTickets) {
      if (!t.match?.match_date?.startsWith(monthKey) || !t.match?.zone_id) continue;
      const dayStr = t.match.match_date.split("T")[0];
      if (!activePairsByDay.has(dayStr)) activePairsByDay.set(dayStr, new Set());
      activePairsByDay.get(dayStr)!.add(t.match.zone_id);
    }
    let monthRevenue = 0;
    for (const [dayStr, zones] of activePairsByDay) {
      monthRevenue += zones.size * getFraisForDate(dayStr);
    }
    revenueChartData.push({ month: monthLabel, revenue: monthRevenue });
  }

  // Graphique journalier frais plateforme
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
    const activeZones = new Set(
      saFilteredTickets
        .filter((t: any) => t.match?.match_date?.startsWith(dayStr) && t.match?.zone_id)
        .map((t: any) => t.match.zone_id)
    );
    dailyPlatformData.push({ date: dayStr, label, revenue: activeZones.size * getFraisForDate(dayStr) });
    chartCursor.setDate(chartCursor.getDate() + 1);
  }

  // Stats par super_admin
  const superAdminStats: { id: string; name: string; zones: number; revenue: number }[] = [];
  if (superAdmins) {
    for (const sa of superAdmins) {
      const { data: zones } = await supabase.from("zones").select("id").eq("created_by", sa.id);
      const zoneIds = zones?.map((z: any) => z.id) || [];
      const revenue = (allTickets || [])
        .filter((t: any) => zoneIds.includes(t.match?.zone_id))
        .reduce((sum: number, t: any) => sum + t.price, 0);

      superAdminStats.push({ id: sa.id, name: sa.full_name, zones: zoneIds.length, revenue });
    }
  }

  const filterSAList = (superAdmins || []).map((s: any) => ({ id: s.id, name: s.full_name }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-heading">Dashboard Fondateur</h1>

      <FondateurFilters superAdmins={filterSAList} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-700">Revenus journaliers</p>
                <p className="text-xl font-bold text-blue-700">{formatFCFA(revenusJournaliers)}</p>
                <p className="text-[10px] text-blue-600 mt-0.5">
                  {new Date(selectedDate + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} · {dailyActiveZones.size} zone(s) active(s)
                </p>
              </div>
              <CalendarDays className="h-7 w-7 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Zones</p>
                <p className="text-2xl font-bold">{zonesCount || 0}</p>
              </div>
              <MapPin className="h-7 w-7 text-brand/40" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-700">Revenus mensuel</p>
                <p className="text-xl font-bold text-amber-700">{formatFCFA(revenusMensuel)}</p>
                <p className="text-[10px] text-amber-600 mt-0.5">Frais plateforme — {monthNames[parseInt(selectedMonth.split("-")[1]) - 1]} {selectedMonth.split("-")[0]}</p>
              </div>
              <Wallet className="h-7 w-7 text-amber-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Billets émis</p>
                <p className="text-2xl font-bold">{totalBillets}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{totalBilScans} scannés</p>
              </div>
              <Ticket className="h-7 w-7 text-brand/40" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue line chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Revenus frais plateforme — 12 derniers mois</CardTitle>
        </CardHeader>
        <CardContent>
          <RevenueLineChart data={revenueChartData} />
        </CardContent>
      </Card>

      {/* Graphique frais plateforme journaliers */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <CardTitle className="text-lg">Recettes Journalières — Frais Plateforme</CardTitle>
            <p className="text-xs text-muted-foreground">
              {new Date(chartFrom + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
              {" → "}
              {new Date(chartTo + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
              {" · tarifs historiques"}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <FraisPlateformeChart data={dailyPlatformData} />
        </CardContent>
      </Card>

      {/* Super Admin performances */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Super Admins — Performances</CardTitle>
        </CardHeader>
        <CardContent>
          {superAdminStats.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Aucun super admin créé</p>
          ) : (
            <div className="space-y-3">
              {superAdminStats.map((sa) => (
                <Link key={sa.id} href={`/fondateur/super-admins/${sa.id}`}>
                  <div className="flex items-center justify-between py-3 border-b last:border-0 hover:bg-muted/30 rounded-lg px-2 -mx-2 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                        <Users className="h-4 w-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-semibold">{sa.name}</p>
                        <p className="text-xs text-muted-foreground">{sa.zones} zone(s)</p>
                      </div>
                    </div>
                    <p className="font-bold text-brand">{formatFCFA(sa.revenue)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

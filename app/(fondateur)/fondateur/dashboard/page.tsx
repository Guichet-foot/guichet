import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MapPin, Banknote, Trophy, Wallet, Ticket } from "lucide-react";
import { formatFCFA } from "@/lib/format";
import { RevenueLineChart } from "./revenue-line-chart";
import { FondateurFilters } from "./fondateur-filters";
import Link from "next/link";

export const metadata = { title: "Dashboard Fondateur" };

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function FondateurDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; sa?: string }>;
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

  // Recettes totales des zones (billetterie)
  const { data: allTickets } = await supabase
    .from("tickets")
    .select("price, sold_at, match:matches(zone_id)")
    .neq("status", "annule") as { data: any[] | null };

  let filteredTickets = allTickets || [];

  // Filter by year
  if (params.year) {
    filteredTickets = filteredTickets.filter((t: any) =>
      t.sold_at?.startsWith(params.year)
    );
  }

  // Filter by super admin (via their zones)
  if (params.sa) {
    const { data: saZones } = await supabase.from("zones").select("id").eq("created_by", params.sa);
    const saZoneIds = new Set(saZones?.map((z: any) => z.id) || []);
    filteredTickets = filteredTickets.filter((t: any) => saZoneIds.has(t.match?.zone_id));
  }

  const totalZoneRevenue = filteredTickets.reduce((sum: number, t: any) => sum + t.price, 0);
  const totalTicketsSold = filteredTickets.length;

  const { count: matchesCount } = await supabase
    .from("matches")
    .select("*", { count: "exact", head: true });

  // Revenus abonnements (placeholder — structure prête mais pas d'interface paiement)
  const totalSubscriptionRevenue = 0;

  // Revenue line chart — 12 derniers mois
  const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  const chartData: { month: string; revenue: number }[] = [];
  const now = new Date();

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthLabel = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`;

    const monthRevenue = (allTickets || [])
      .filter((t: any) => t.sold_at?.startsWith(monthKey))
      .reduce((sum: number, t: any) => sum + t.price, 0);

    chartData.push({ month: monthLabel, revenue: monthRevenue });
  }

  // Stats par super_admin
  const superAdminStats: { id: string; name: string; zones: number; revenue: number }[] = [];
  if (superAdmins) {
    for (const sa of superAdmins) {
      const { data: zones } = await supabase
        .from("zones")
        .select("id")
        .eq("created_by", sa.id);

      const zoneIds = zones?.map((z: any) => z.id) || [];
      const revenue = (allTickets || [])
        .filter((t: any) => zoneIds.includes(t.match?.zone_id))
        .reduce((sum: number, t: any) => sum + t.price, 0);

      superAdminStats.push({
        id: sa.id,
        name: sa.full_name,
        zones: zoneIds.length,
        revenue,
      });
    }
  }

  const filterSAList = (superAdmins || []).map((s: any) => ({ id: s.id, name: s.full_name }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-heading">Dashboard Fondateur</h1>

      <FondateurFilters superAdmins={filterSAList} />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Super Admins</p>
                <p className="text-2xl font-bold">{superAdmins?.length || 0}</p>
              </div>
              <Users className="h-7 w-7 text-amber-400" />
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
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Recettes zones</p>
                <p className="text-xl font-bold text-brand">{formatFCFA(totalZoneRevenue)}</p>
              </div>
              <Banknote className="h-7 w-7 text-brand/40" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-700">Revenus abonnements</p>
                <p className="text-xl font-bold text-amber-700">{formatFCFA(totalSubscriptionRevenue)}</p>
              </div>
              <Wallet className="h-7 w-7 text-amber-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Billets vendus</p>
                <p className="text-2xl font-bold">{totalTicketsSold}</p>
              </div>
              <Ticket className="h-7 w-7 text-brand/40" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue line chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Revenus — 12 derniers mois</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <RevenueLineChart data={chartData} />
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

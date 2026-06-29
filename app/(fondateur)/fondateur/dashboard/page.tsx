import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MapPin, Banknote, Trophy } from "lucide-react";
import { formatFCFA } from "@/lib/format";

export const metadata = { title: "Dashboard Fondateur" };

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function FondateurDashboardPage() {
  const profile = await requireRole(["fondateur"]);
  const supabase = await createAdminClient();

  const { data: superAdmins } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "super_admin")
    .eq("created_by_admin", profile.id);

  const { count: zonesCount } = await supabase
    .from("zones")
    .select("*", { count: "exact", head: true });

  const { data: allTickets } = await supabase
    .from("tickets")
    .select("price")
    .neq("status", "annule");

  const totalRevenue = allTickets?.reduce((sum: number, t: any) => sum + t.price, 0) || 0;

  const { count: matchesCount } = await supabase
    .from("matches")
    .select("*", { count: "exact", head: true });

  // Stats par super_admin
  const superAdminStats: { id: string; name: string; zones: number; revenue: number }[] = [];
  if (superAdmins) {
    for (const sa of superAdmins) {
      const { data: zones } = await supabase
        .from("zones")
        .select("id")
        .eq("created_by", sa.id);

      const zoneIds = zones?.map((z: any) => z.id) || [];
      let revenue = 0;

      if (zoneIds.length > 0) {
        const { data: tickets } = await supabase
          .from("tickets")
          .select("price, match:matches(zone_id)")
          .neq("status", "annule") as { data: any[] | null };

        revenue = tickets
          ?.filter((t: any) => zoneIds.includes(t.match?.zone_id))
          .reduce((sum: number, t: any) => sum + t.price, 0) || 0;
      }

      superAdminStats.push({
        id: sa.id,
        name: sa.full_name,
        zones: zoneIds.length,
        revenue,
      });
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-heading">Dashboard Fondateur</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Super Admins</p>
                <p className="text-2xl font-bold">{superAdmins?.length || 0}</p>
              </div>
              <Users className="h-8 w-8 text-amber-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Zones totales</p>
                <p className="text-2xl font-bold">{zonesCount || 0}</p>
              </div>
              <MapPin className="h-8 w-8 text-brand/40" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Recettes totales</p>
                <p className="text-2xl font-bold text-brand">{formatFCFA(totalRevenue)}</p>
              </div>
              <Banknote className="h-8 w-8 text-brand/40" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Matchs totaux</p>
                <p className="text-2xl font-bold">{matchesCount || 0}</p>
              </div>
              <Trophy className="h-8 w-8 text-brand/40" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Super Admins et leurs performances</CardTitle>
        </CardHeader>
        <CardContent>
          {superAdminStats.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Aucun super admin créé</p>
          ) : (
            <div className="space-y-3">
              {superAdminStats.map((sa) => (
                <div key={sa.id} className="flex items-center justify-between py-3 border-b last:border-0">
                  <div>
                    <p className="font-semibold">{sa.name}</p>
                    <p className="text-sm text-muted-foreground">{sa.zones} zone(s)</p>
                  </div>
                  <p className="font-bold text-brand">{formatFCFA(sa.revenue)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

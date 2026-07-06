import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Banknote, Ticket, Trophy } from "lucide-react";
import { formatFCFA } from "@/lib/format";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function SuperAdminDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole(["fondateur"]);
  const supabase = await createAdminClient();

  const { data: sa } = await supabase
    .from("profiles")
    .select("id, full_name, phone, role, active, created_at")
    .eq("id", id)
    .eq("role", "super_admin")
    .single();

  if (!sa) notFound();

  const { data: zones } = await supabase
    .from("zones")
    .select("id, name, region")
    .eq("created_by", sa.id)
    .order("name");

  const zoneIds = zones?.map((z: any) => z.id) || [];
  const zoneStats: Record<string, { tickets: number; revenue: number; matches: number }> = {};

  if (zoneIds.length > 0) {
    for (const zId of zoneIds) {
      const { data: tickets } = await supabase
        .from("tickets")
        .select("price, match:matches(zone_id)")
        .eq("counts_as_revenue", true) as { data: any[] | null };

      const zoneTickets = tickets?.filter((t: any) => t.match?.zone_id === zId) || [];

      const { count: matchCount } = await supabase
        .from("matches")
        .select("*", { count: "exact", head: true })
        .eq("zone_id", zId);

      zoneStats[zId] = {
        tickets: zoneTickets.length,
        revenue: zoneTickets.reduce((sum: number, t: any) => sum + t.price, 0),
        matches: matchCount || 0,
      };
    }
  }

  const totalRevenue = Object.values(zoneStats).reduce((sum, s) => sum + s.revenue, 0);
  const totalTickets = Object.values(zoneStats).reduce((sum, s) => sum + s.tickets, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/fondateur/super-admins">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Retour</Button>
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">{sa.full_name}</h1>
          <p className="text-muted-foreground">Super Admin</p>
        </div>
        <Badge variant="secondary" className={sa.active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
          {sa.active ? "Actif" : "Suspendu"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Zones</p>
            <p className="text-2xl font-bold">{zones?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Recettes totales</p>
            <p className="text-2xl font-bold text-brand">{formatFCFA(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Billets vendus</p>
            <p className="text-2xl font-bold">{totalTickets}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Matchs totaux</p>
            <p className="text-2xl font-bold">{Object.values(zoneStats).reduce((s, v) => s + v.matches, 0)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Zones gérées</CardTitle></CardHeader>
        <CardContent>
          {!zones || zones.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Aucune zone créée</p>
          ) : (
            <div className="space-y-3">
              {zones.map((zone: any) => {
                const s = zoneStats[zone.id] || { tickets: 0, revenue: 0, matches: 0 };
                return (
                  <div key={zone.id} className="flex items-center justify-between py-3 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center">
                        <MapPin className="h-5 w-5 text-brand" />
                      </div>
                      <div>
                        <p className="font-semibold">{zone.name}</p>
                        <p className="text-xs text-muted-foreground">{zone.region || "—"}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-brand">{formatFCFA(s.revenue)}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.tickets} billets · {s.matches} matchs
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

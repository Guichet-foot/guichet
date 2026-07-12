import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, MapPin, Banknote, Ticket, Trophy, Users, Crown, UserCheck } from "lucide-react";
import { formatFCFA } from "@/lib/format";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/constants";
import { DeleteZoneButton } from "./delete-zone-button";
import { CreateZoneButton, EditZoneButton } from "./zone-buttons";
import { CreateUserButton } from "./create-user-button";
import { UserItemActions } from "./user-item-actions";

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
    .in("role", ["super_admin", "president_odcav"])
    .single();

  if (!sa) notFound();

  // ── Zones ────────────────────────────────────────────────────────────────────
  const { data: zones } = await supabase
    .from("zones")
    .select("id, name, region")
    .eq("created_by", sa.id)
    .order("name");

  const zoneIds = zones?.map((z: any) => z.id) || [];
  const zoneMap: Record<string, string> = {};
  (zones || []).forEach((z: any) => { zoneMap[z.id] = z.name; });

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

  // ── Sub-accounts (users created by this ODCAV) ────────────────────────────────
  const { data: subUsers } = await supabase
    .from("profiles")
    .select("id, full_name, phone, role, zone_id, active, is_president, created_at")
    .eq("created_by_admin", sa.id)
    .in("role", ["admin_zone", "tresorier", "c3", "caissier", "portier"])
    .order("role")
    .order("full_name");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/fondateur/super-admins">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Retour</Button>
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">{sa.full_name}</h1>
          <p className="text-muted-foreground">{sa.role === "president_odcav" ? "Président ODCAV" : "Super Admin"}</p>
        </div>
        <Badge variant="secondary" className={sa.active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
          {sa.active ? "Actif" : "Suspendu"}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Zones</p>
            </div>
            <p className="text-2xl font-bold">{zones?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <Banknote className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Recettes totales</p>
            </div>
            <p className="text-2xl font-bold text-brand">{formatFCFA(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <Ticket className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Billets vendus</p>
            </div>
            <p className="text-2xl font-bold">{totalTickets}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Matchs</p>
            </div>
            <p className="text-2xl font-bold">{Object.values(zoneStats).reduce((s, v) => s + v.matches, 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Users section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Utilisateurs ({subUsers?.length || 0})</CardTitle>
            </div>
            <CreateUserButton
              odcavId={sa.id}
              odcavName={sa.full_name}
              zones={(zones || []) as { id: string; name: string; region?: string | null }[]}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!subUsers || subUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
              <UserCheck className="h-10 w-10" />
              <p className="text-sm">Aucun utilisateur créé pour ce compte</p>
              <p className="text-xs">Cliquez sur &quot;Créer un utilisateur&quot; pour commencer</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead className="hidden sm:table-cell">Zone</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(subUsers as any[]).map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          {user.is_president && <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                          {user.full_name}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {user.zone_id ? (zoneMap[user.zone_id] || "—") : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={ROLE_COLORS[user.role] || ""}>
                          {ROLE_LABELS[user.role] || user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={user.active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}
                        >
                          {user.active ? "Actif" : "Suspendu"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <UserItemActions
                          userId={user.id}
                          odcavId={sa.id}
                          userName={user.full_name}
                          active={user.active}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Zones section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Zones gérées ({zones?.length || 0})</CardTitle>
            </div>
            <CreateZoneButton odcavId={sa.id} />
          </div>
        </CardHeader>
        <CardContent>
          {!zones || zones.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Aucune zone créée</p>
          ) : (
            <div className="space-y-3">
              {zones.map((zone: any) => {
                const s = zoneStats[zone.id] || { tickets: 0, revenue: 0, matches: 0 };
                return (
                  <div key={zone.id} className="flex items-center justify-between py-3 border-b last:border-0 gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
                        <MapPin className="h-5 w-5 text-brand" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{zone.name}</p>
                        <p className="text-xs text-muted-foreground">{zone.region || "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="font-bold text-brand">{formatFCFA(s.revenue)}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.tickets} billets · {s.matches} matchs
                        </p>
                      </div>
                      <EditZoneButton
                        zoneId={zone.id}
                        odcavId={sa.id}
                        initialName={zone.name}
                        initialRegion={zone.region || ""}
                      />
                      <DeleteZoneButton
                        zoneId={zone.id}
                        zoneName={zone.name}
                        tickets={s.tickets}
                        matches={s.matches}
                      />
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

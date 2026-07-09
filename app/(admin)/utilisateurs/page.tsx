import { requireRole } from "@/lib/auth";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getEffectiveZone } from "@/lib/get-effective-zone";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Users, Crown, MapPin, Network } from "lucide-react";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/constants";
import { buildZoneUrl } from "@/lib/zone-utils";
import { UserActions } from "./user-actions";
import { ZoneCardGrid } from "@/components/zone-card-grid";
import { ZoneBackHeader } from "@/components/zone-back-header";

export const metadata = { title: "Utilisateurs" };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ zone?: string; tab?: string }>;
}) {
  const profile = await requireRole(["super_admin", "admin_zone", "c3"]);
  const params = await searchParams;
  const activeTab = params.tab === "directs" ? "directs" : "zones";
  const isOdcavRole = profile.role === "super_admin" || profile.role === "president_odcav";

  // ── Comptes directs tab ──────────────────────────────────────────
  if (isOdcavRole && activeTab === "directs") {
    const adminClient = await createAdminClient();
    const { data: directUsers } = await adminClient
      .from("profiles")
      .select("*")
      .eq("created_by_admin", profile.id)
      .is("zone_id", null)
      .in("role", ["c3", "super_admin", "tresorier"])
      .order("created_at", { ascending: false });

    return (
      <div className="space-y-6">
        <TabBar active="directs" />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-heading">Comptes directs</h1>
            <p className="text-muted-foreground">{directUsers?.length || 0} compte(s)</p>
          </div>
          <Link href="/utilisateurs/nouveau?tab=directs">
            <Button className="bg-brand hover:bg-brand/90">
              <Plus className="h-4 w-4 mr-2" />
              Nouveau
            </Button>
          </Link>
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            {!directUsers || directUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Network className="h-12 w-12 mb-4" />
                <p>Aucun compte direct</p>
                <p className="text-sm mt-1">Créez des comptes C3 ou des comptes avec accès direct</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead className="hidden sm:table-cell">Ville</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(directUsers as any[]).map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell className="hidden sm:table-cell">{user.city || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={ROLE_COLORS[user.role]}>
                          {ROLE_LABELS[user.role]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={user.active ? "default" : "destructive"}
                          className={user.active ? "bg-success/10 text-success" : ""}
                        >
                          {user.active ? "Actif" : "Inactif"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <UserActions
                          user={{
                            id: user.id,
                            full_name: user.full_name,
                            phone: user.phone,
                            role: user.role,
                            active: user.active,
                            is_president: user.is_president ?? false,
                          }}
                          currentUserId={profile.id}
                          currentUserRole={profile.role}
                          currentUserIsPresident={profile.is_president ?? false}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Zones tab (default) ──────────────────────────────────────────
  const { effectiveZoneId, selectedZone, ownedZones, needsZoneSelection, c3AccountId } =
    await getEffectiveZone(profile, params.zone);

  if (needsZoneSelection) {
    return (
      <div className="space-y-6">
        {isOdcavRole && <TabBar active="zones" />}
        <ZoneCardGrid zones={ownedZones} title="Utilisateurs" />
      </div>
    );
  }

  const supabase = await createClient();

  const query = supabase
    .from("profiles")
    .select("*, zone:zones!profiles_zone_id_fkey(name)")
    .order("created_at", { ascending: false });

  if (c3AccountId) {
    query.eq("created_by_admin", c3AccountId);
  } else if (effectiveZoneId) {
    query.eq("zone_id", effectiveZoneId);
  }

  const { data: users } = await query;
  const currentUserIsPresident = profile.is_president ?? false;

  return (
    <div className="space-y-6">
      {isOdcavRole && !params.zone && <TabBar active="zones" />}
      {profile.role === "super_admin" && selectedZone && <ZoneBackHeader zoneName={selectedZone.name} />}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Utilisateurs</h1>
          <p className="text-muted-foreground">{users?.length || 0} utilisateur(s)</p>
        </div>
        <Link href={buildZoneUrl("/utilisateurs/nouveau", params.zone)}>
          <Button className="bg-brand hover:bg-brand/90">
            <Plus className="h-4 w-4 mr-2" />
            Nouveau
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {!users || users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mb-4" />
              <p>Aucun utilisateur</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead className="hidden sm:table-cell">Téléphone</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(users as any[]).map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell className="hidden sm:table-cell">{user.phone || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="secondary" className={ROLE_COLORS[user.role]}>
                          {ROLE_LABELS[user.role]}
                        </Badge>
                        {user.is_president && (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-300 gap-1">
                            <Crown className="h-3 w-3" />
                            Président
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={user.active ? "default" : "destructive"}
                        className={user.active ? "bg-success/10 text-success" : ""}
                      >
                        {user.active ? "Actif" : "Inactif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <UserActions
                        user={{
                          id: user.id,
                          full_name: user.full_name,
                          phone: user.phone,
                          role: user.role,
                          active: user.active,
                          is_president: user.is_president ?? false,
                        }}
                        currentUserId={profile.id}
                        currentUserRole={profile.role}
                        currentUserIsPresident={currentUserIsPresident}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TabBar({ active }: { active: "zones" | "directs" }) {
  return (
    <div className="flex gap-1 border-b">
      <Link
        href="/utilisateurs"
        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
          active === "zones"
            ? "border-brand text-brand"
            : "border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        <MapPin className="h-4 w-4" />
        Zones
      </Link>
      <Link
        href="/utilisateurs?tab=directs"
        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
          active === "directs"
            ? "border-brand text-brand"
            : "border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        <Network className="h-4 w-4" />
        Comptes directs
      </Link>
    </div>
  );
}

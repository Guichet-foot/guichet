import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveZone } from "@/lib/get-effective-zone";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Users } from "lucide-react";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/constants";
import { buildZoneUrl } from "@/lib/zone-utils";
import { UserActions } from "./user-actions";
import { ZoneCardGrid } from "@/components/zone-card-grid";
import { ZoneBackHeader } from "@/components/zone-back-header";

export const metadata = { title: "Utilisateurs" };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ zone?: string }>;
}) {
  const profile = await requireRole(["super_admin", "admin_zone"]);
  const params = await searchParams;
  const { effectiveZoneId, selectedZone, ownedZones, needsZoneSelection } =
    await getEffectiveZone(profile, params.zone);

  if (needsZoneSelection) {
    return <ZoneCardGrid zones={ownedZones} title="Utilisateurs" />;
  }

  const supabase = await createClient();

  const query = supabase
    .from("profiles")
    .select("*, zone:zones!profiles_zone_id_fkey(name)")
    .order("created_at", { ascending: false });

  if (effectiveZoneId) {
    query.eq("zone_id", effectiveZoneId);
  }

  const { data: users } = await query;

  return (
    <div className="space-y-6">
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
        <CardContent className="p-0">
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
                {users.map((user: any) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell className="hidden sm:table-cell">{user.phone || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={ROLE_COLORS[user.role]}>{ROLE_LABELS[user.role]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.active ? "default" : "destructive"} className={user.active ? "bg-success/10 text-success" : ""}>
                        {user.active ? "Actif" : "Inactif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <UserActions
                        user={{ id: user.id, full_name: user.full_name, phone: user.phone, role: user.role, active: user.active }}
                        currentUserId={profile.id}
                        currentUserRole={profile.role}
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

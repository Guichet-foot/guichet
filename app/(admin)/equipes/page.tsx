import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Shield } from "lucide-react";
import { TeamFormDialog } from "./team-form-dialog";
import { TeamActions } from "./team-actions-buttons";

export const metadata = { title: "Équipes" };

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function EquipesPage() {
  const profile = await requireRole(["super_admin", "admin_zone"]);
  const supabase = await createClient();

  let query = supabase
    .from("teams")
    .select("*, zone:zones(name)")
    .order("name");

  if (profile.role === "admin_zone") {
    query = query.eq("zone_id", profile.zone_id!);
  }

  const { data: teams } = (await query) as { data: any[] | null };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Équipes</h1>
          <p className="text-muted-foreground">
            {teams?.length || 0} équipe(s) enregistrée(s)
          </p>
        </div>
        <TeamFormDialog
          zoneId={profile.zone_id}
          userRole={profile.role}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {!teams || teams.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mb-4" />
              <p>Aucune équipe enregistrée</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom ASC</TableHead>
                  <TableHead className="hidden sm:table-cell">Président</TableHead>
                  <TableHead className="hidden md:table-cell">Délégué(s)</TableHead>
                  <TableHead className="hidden sm:table-cell">Couleurs</TableHead>
                  {profile.role === "super_admin" && (
                    <TableHead className="hidden lg:table-cell">Zone</TableHead>
                  )}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((team: any) => (
                  <TableRow key={team.id}>
                    <TableCell className="font-semibold">
                      {team.name}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {team.president || "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {team.delegates && team.delegates.length > 0
                          ? team.delegates.map((d: string, i: number) => (
                              <Badge
                                key={i}
                                variant="secondary"
                                className="text-xs"
                              >
                                {d}
                              </Badge>
                            ))
                          : "—"}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {team.colors ? (
                        <span className="text-sm">{team.colors}</span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    {profile.role === "super_admin" && (
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {team.zone?.name || "—"}
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <TeamActions
                        team={{
                          id: team.id,
                          name: team.name,
                          president: team.president,
                          delegates: team.delegates || [],
                          colors: team.colors,
                          zone_id: team.zone_id,
                        }}
                        zoneId={profile.zone_id}
                        userRole={profile.role}
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

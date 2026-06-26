import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveZone } from "@/lib/get-effective-zone";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Shield } from "lucide-react";
import { TeamFormDialog } from "./team-form-dialog";
import { TeamActions } from "./team-actions-buttons";
import { ZoneCardGrid } from "@/components/zone-card-grid";
import { ZoneBackHeader } from "@/components/zone-back-header";

export const metadata = { title: "Équipes" };

/* eslint-disable @typescript-eslint/no-explicit-any */

function TeamColorSwatches({ colors }: { colors: string }) {
  try {
    const parsed = JSON.parse(colors);
    const off = parsed.official || [];
    const sub = parsed.substitute || [];
    return (
      <div className="flex items-center gap-2">
        {off.length === 2 && (
          <div className="w-6 h-6 rounded border border-border shrink-0" style={{ background: `linear-gradient(135deg, ${off[0]} 50%, ${off[1]} 50%)` }} title="Officielle" />
        )}
        {sub.length === 2 && (
          <div className="w-6 h-6 rounded border border-border shrink-0" style={{ background: `linear-gradient(135deg, ${sub[0]} 50%, ${sub[1]} 50%)` }} title="Substitution" />
        )}
      </div>
    );
  } catch {
    return <span className="text-sm">{colors}</span>;
  }
}

export default async function EquipesPage({
  searchParams,
}: {
  searchParams: Promise<{ zone?: string }>;
}) {
  const profile = await requireRole(["super_admin", "admin_zone"]);
  const params = await searchParams;
  const { effectiveZoneId, selectedZone, ownedZones, needsZoneSelection } =
    await getEffectiveZone(profile, params.zone);

  if (needsZoneSelection) {
    return <ZoneCardGrid zones={ownedZones} title="Équipes" />;
  }

  const supabase = await createClient();

  let query = supabase.from("teams").select("*").order("name");
  if (effectiveZoneId) query = query.eq("zone_id", effectiveZoneId);

  const { data: teams } = (await query) as { data: any[] | null };

  return (
    <div className="space-y-6">
      {profile.role === "super_admin" && selectedZone && <ZoneBackHeader zoneName={selectedZone.name} />}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Équipes</h1>
          <p className="text-muted-foreground">{teams?.length || 0} équipe(s)</p>
        </div>
        <TeamFormDialog zoneId={effectiveZoneId} userRole={profile.role} />
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
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((team: any) => (
                  <TableRow key={team.id}>
                    <TableCell className="font-semibold">{team.name}</TableCell>
                    <TableCell className="hidden sm:table-cell">{team.president || "—"}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {team.delegates && team.delegates.length > 0
                          ? team.delegates.map((d: string, i: number) => (
                              <Badge key={i} variant="secondary" className="text-xs">{d}</Badge>
                            ))
                          : "—"}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {team.colors ? <TeamColorSwatches colors={team.colors} /> : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <TeamActions
                        team={{ id: team.id, name: team.name, president: team.president, delegates: team.delegates || [], colors: team.colors, zone_id: team.zone_id }}
                        zoneId={effectiveZoneId}
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

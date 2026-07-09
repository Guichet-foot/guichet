import { requireRole } from "@/lib/auth";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getEffectiveZone } from "@/lib/get-effective-zone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const profile = await requireRole(["super_admin", "admin_zone", "c3"]);
  const params = await searchParams;
  const { effectiveZoneId, selectedZone, ownedZones, needsZoneSelection, c3AccountId } =
    await getEffectiveZone(profile, params.zone);

  if (needsZoneSelection) {
    return <ZoneCardGrid zones={ownedZones} title="Équipes" />;
  }

  const supabase = await createClient();

  // ── C3 : vue 2 colonnes par zone ──────────────────────────────
  if (c3AccountId) {
    const allowedZones = profile.allowed_zones;
    let zonesData: { id: string; name: string }[] = [];
    let allTeams: any[] = [];

    if (allowedZones && allowedZones.length > 0) {
      const adminClient = await createAdminClient();
      const [{ data: zd }, { data: td }] = await Promise.all([
        adminClient.from("zones").select("id, name").in("id", allowedZones).order("name"),
        adminClient.from("teams").select("*").in("zone_id", allowedZones).order("name"),
      ]);
      zonesData = zd || [];
      allTeams = td || [];
    } else {
      // Ancien compte C3 sans allowed_zones — RLS gère la restriction
      const { data: td } = await supabase.from("teams").select("*").order("name");
      allTeams = td || [];
    }

    const teamsByZone = zonesData.map((zone) => ({
      zone,
      teams: allTeams.filter((t: any) => t.zone_id === zone.id),
    }));

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-heading">Équipes</h1>
          <p className="text-muted-foreground">{allTeams.length} équipe(s)</p>
        </div>

        {allTeams.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mb-4" />
              <p>Aucune équipe enregistrée</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {teamsByZone.map(({ zone, teams: zoneTeams }) => (
              <Card key={zone.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Shield className="h-4 w-4 text-brand" />
                    {zone.name}
                    <Badge variant="secondary" className="ml-auto text-xs font-normal">
                      {zoneTeams.length} équipe{zoneTeams.length !== 1 ? "s" : ""}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {zoneTeams.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-4 pb-4">Aucune équipe dans cette zone</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nom ASC</TableHead>
                          <TableHead className="hidden sm:table-cell">Président</TableHead>
                          <TableHead>Couleurs</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {zoneTeams.map((team: any) => (
                          <TableRow key={team.id}>
                            <TableCell className="font-semibold">{team.name}</TableCell>
                            <TableCell className="hidden sm:table-cell text-sm">{team.president || "—"}</TableCell>
                            <TableCell>
                              {team.colors ? <TeamColorSwatches colors={team.colors} /> : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Vue normale (admin_zone / super_admin) ────────────────────
  let teams: any[] | null = null;
  {
    const baseQuery = supabase.from("teams").select("*").order("name");
    const { data } = effectiveZoneId
      ? await baseQuery.eq("zone_id", effectiveZoneId)
      : await baseQuery;
    teams = data;
  }

  return (
    <div className="space-y-6">
      {["super_admin","president_odcav","tresorier"].includes(profile.role) && selectedZone && <ZoneBackHeader zoneName={selectedZone.name} />}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Équipes</h1>
          <p className="text-muted-foreground">{teams?.length || 0} équipe(s)</p>
        </div>
        {profile.role !== "tresorier" && <TeamFormDialog zoneId={effectiveZoneId} userRole={profile.role} />}
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
                  {profile.role !== "tresorier" && <TableHead className="text-right">Actions</TableHead>}
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
                    {profile.role !== "tresorier" && (
                      <TableCell className="text-right">
                        <TeamActions
                          team={{ id: team.id, name: team.name, president: team.president, delegates: team.delegates || [], colors: team.colors, zone_id: team.zone_id }}
                          zoneId={effectiveZoneId}
                          userRole={profile.role}
                        />
                      </TableCell>
                    )}
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

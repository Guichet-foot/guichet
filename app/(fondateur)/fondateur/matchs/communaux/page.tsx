import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { getOdcavInterMatches } from "@/lib/actions/odcav-match-actions";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trophy, MapPin, Users, Building2 } from "lucide-react";
import { MATCH_STATUS_LABELS, MATCH_STATUS_COLORS } from "@/lib/constants";
import { formatDateShort, fmtZone } from "@/lib/format";
import { PrintBlocsButton } from "@/app/(admin)/matchs/print-blocs-button";
import { MatchActionButtons } from "@/app/(admin)/matchs/match-action-buttons";

export const metadata = { title: "Matchs Communal — Fondateur" };

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function FondateurMatchsCommunauxPage() {
  await requireRole(["fondateur"]);
  const matches = await getOdcavInterMatches("Match Communal");

  // Build ODCAV name map from created_by IDs
  const adminClient = await createAdminClient();
  const creatorIds = [...new Set(matches.map((m: any) => m.created_by).filter(Boolean))];
  let odcavMap: Map<string, string> = new Map();
  if (creatorIds.length > 0) {
    const { data: profiles } = await adminClient
      .from("profiles")
      .select("id, full_name")
      .in("id", creatorIds);
    if (profiles) {
      odcavMap = new Map((profiles as any[]).map((p) => [p.id as string, p.full_name as string ?? "—"]));
    }
  }

  return (
    <div className="space-y-6">
      <FondateurMatchTabBar active="communaux" />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading">Matchs Communal</h1>
          <p className="text-muted-foreground">{matches.length} match(s)</p>
        </div>
        <Link href="/fondateur/matchs/communaux/nouveau">
          <Button className="bg-brand hover:bg-brand/90">
            <Plus className="h-4 w-4 mr-2" />
            Nouveau match communal
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {matches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Trophy className="h-12 w-12 mb-4" />
              <p>Aucun match communal</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Match</TableHead>
                  <TableHead className="hidden lg:table-cell">ODCAV</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="hidden sm:table-cell">Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(matches as any[]).map((match) => {
                  const homeDisplay = match.home_team_zone
                    ? `${match.home_team} (${fmtZone(match.home_team_zone)})`
                    : match.home_team;
                  const awayDisplay = match.away_team_zone
                    ? `${match.away_team} (${fmtZone(match.away_team_zone)})`
                    : match.away_team;
                  return (
                    <TableRow key={match.id}>
                      <TableCell className="font-medium">
                        <span>{homeDisplay}</span>
                        <span className="text-muted-foreground mx-1 text-xs">vs</span>
                        <span>{awayDisplay}</span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {odcavMap.get(match.created_by) ?? "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {formatDateShort(match.match_date)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="secondary" className={MATCH_STATUS_COLORS[match.status]}>
                          {MATCH_STATUS_LABELS[match.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-1 justify-end">
                          {match.status !== "termine" && match.status !== "annule" && (
                            <PrintBlocsButton
                              matchId={match.id}
                              matchName={`${match.home_team} vs ${match.away_team}`}
                            />
                          )}
                          <MatchActionButtons
                            matchId={match.id}
                            zoneId={null}
                            status={match.status}
                            venteActive={match.vente_active ?? false}
                            homeTeam={match.home_team}
                            awayTeam={match.away_team}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FondateurMatchTabBar({ active }: { active: "zones" | "communaux" | "departementaux" }) {
  const tabs = [
    { key: "zones", label: "Match Zone", href: "/fondateur/matchs", icon: MapPin },
    { key: "communaux", label: "Matchs Communal", href: "/fondateur/matchs/communaux", icon: Users },
    { key: "departementaux", label: "Matchs Départementals", href: "/fondateur/matchs/departementaux", icon: Building2 },
  ] as const;

  return (
    <div className="flex gap-1 border-b overflow-x-auto">
      {tabs.map(({ key, label, href, icon: Icon }) => (
        <Link
          key={key}
          href={href}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
            active === key
              ? "border-brand text-brand"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon className="h-4 w-4" />
          {label}
        </Link>
      ))}
    </div>
  );
}

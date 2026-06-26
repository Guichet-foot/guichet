import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Plus, CalendarPlus, Shield } from "lucide-react";
import { formatDateShort } from "@/lib/format";
import type { Standing } from "@/lib/types";
import { ProgrammeManager } from "./programme-manager";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole(["super_admin", "admin_zone"]);
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", id)
    .single();

  if (!tournament) notFound();

  const { data: groups } = (await supabase
    .from("tournament_groups")
    .select("*, group_teams:tournament_group_teams(id, team:teams(id, name, colors))")
    .eq("tournament_id", id)
    .order("display_order")) as { data: any[] | null };

  const { data: zoneTeams } = await supabase
    .from("teams")
    .select("id, name")
    .eq("zone_id", tournament.zone_id)
    .order("name");

  const { data: matches } = (await supabase
    .from("tournament_matches")
    .select("*, home_team:teams!tournament_matches_home_team_id_fkey(id, name), away_team:teams!tournament_matches_away_team_id_fkey(id, name), group:tournament_groups(id, name)")
    .eq("tournament_id", id)
    .order("journee")
    .order("created_at")) as { data: any[] | null };

  // Compute standings
  const standingsByGroup: Record<string, Standing[]> = {};

  if (groups && matches) {
    for (const group of groups) {
      const groupTeams = group.group_teams || [];
      const groupMatches = matches.filter(
        (m: any) => m.group_id === group.id && m.status === "termine"
      );

      const standings: Record<string, Standing> = {};

      for (const gt of groupTeams) {
        if (!gt.team) continue;
        standings[gt.team.id] = {
          teamId: gt.team.id,
          teamName: gt.team.name,
          played: 0, won: 0, drawn: 0, lost: 0,
          goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0,
        };
      }

      for (const m of groupMatches) {
        if (m.home_score === null || m.away_score === null) continue;
        const home = standings[m.home_team_id];
        const away = standings[m.away_team_id];
        if (!home || !away) continue;

        home.played++; away.played++;
        home.goalsFor += m.home_score; home.goalsAgainst += m.away_score;
        away.goalsFor += m.away_score; away.goalsAgainst += m.home_score;

        if (m.home_score > m.away_score) {
          home.won++; home.points += 3; away.lost++;
        } else if (m.home_score < m.away_score) {
          away.won++; away.points += 3; home.lost++;
        } else {
          home.drawn++; away.drawn++; home.points += 1; away.points += 1;
        }
        home.goalDifference = home.goalsFor - home.goalsAgainst;
        away.goalDifference = away.goalsFor - away.goalsAgainst;
      }

      standingsByGroup[group.id] = Object.values(standings).sort(
        (a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor
      );
    }
  }

  const hasGroups = groups && groups.length > 0;
  const hasMatches = matches && matches.length > 0;
  const isEmpty = !hasGroups;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/programme">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Programme
          </Button>
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">{tournament.name}</h1>
          <p className="text-muted-foreground">Saison {tournament.season}</p>
        </div>
        <Badge
          variant="secondary"
          className={tournament.status === "en_cours" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}
        >
          {tournament.status === "en_cours" ? "En cours" : "Terminé"}
        </Badge>
      </div>

      {isEmpty ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Shield className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
            <h2 className="text-xl font-semibold mb-2">Programme vide</h2>
            <p className="text-muted-foreground mb-6">
              Commencez par créer des poules et ajouter des équipes
            </p>
            <ProgrammeManager
              tournamentId={id}
              groups={[]}
              zoneTeams={zoneTeams || []}
              mode="setup"
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Management bar */}
          <ProgrammeManager
            tournamentId={id}
            groups={groups || []}
            zoneTeams={zoneTeams || []}
            mode="bar"
          />

          {/* Main content: Classements + Résultats side by side */}
          {(groups || []).map((group: any) => {
            const groupStandings = standingsByGroup[group.id] || [];
            const groupMatches = (matches || []).filter((m: any) => m.group_id === group.id);

            return (
              <div key={group.id} className="space-y-2">
                <h2 className="text-lg font-bold font-heading bg-brand text-white px-4 py-2 rounded-lg">
                  {group.name}
                </h2>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {/* LEFT: Classement */}
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="w-10 font-bold">Rang</TableHead>
                            <TableHead className="font-bold">Équipe</TableHead>
                            <TableHead className="text-center w-10 font-bold">MJ</TableHead>
                            <TableHead className="text-center w-10 font-bold text-brand">Pts</TableHead>
                            <TableHead className="text-center w-12 font-bold">Diff</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {groupStandings.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                                Aucune équipe
                              </TableCell>
                            </TableRow>
                          ) : (
                            groupStandings.map((s, i) => (
                              <TableRow key={s.teamId} className={i < 2 ? "bg-brand/5" : ""}>
                                <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                                <TableCell className="font-semibold">{s.teamName}</TableCell>
                                <TableCell className="text-center">{s.played}</TableCell>
                                <TableCell className="text-center font-bold text-brand text-lg">{s.points}</TableCell>
                                <TableCell className="text-center">
                                  {s.goalDifference > 0 ? `+${s.goalDifference}` : s.goalDifference}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  {/* RIGHT: Résultats des matchs */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-bold uppercase text-muted-foreground">
                        Résultats des matchs
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="w-8 text-center font-bold">N°</TableHead>
                            <TableHead className="text-right font-bold">Domicile</TableHead>
                            <TableHead className="text-center w-16 font-bold">Score</TableHead>
                            <TableHead className="font-bold">Visiteur</TableHead>
                            <TableHead className="hidden sm:table-cell font-bold">Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {groupMatches.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                                Aucun match
                              </TableCell>
                            </TableRow>
                          ) : (
                            groupMatches.map((m: any, i: number) => (
                              <TableRow key={m.id}>
                                <TableCell className="text-center text-muted-foreground text-xs">{i + 1}</TableCell>
                                <TableCell className="text-right text-sm font-semibold">{m.home_team?.name}</TableCell>
                                <TableCell className="text-center">
                                  {m.status === "termine" ? (
                                    <span className="inline-block bg-brand text-white text-xs font-bold px-2 py-0.5 rounded">
                                      {m.home_score} - {m.away_score}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-sm font-semibold">{m.away_team?.name}</TableCell>
                                <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                                  {m.match_date ? formatDateShort(m.match_date) : "—"}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

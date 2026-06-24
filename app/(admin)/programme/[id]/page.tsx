import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { PoulesTab } from "./poules-tab";
import { CalendrierTab } from "./calendrier-tab";
import { ClassementsTab } from "./classements-tab";
import { TournamentTabs } from "./tournament-tabs";
import type { Standing } from "@/lib/types";

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

  // Fetch groups with their teams
  const { data: groups } = (await supabase
    .from("tournament_groups")
    .select("*, group_teams:tournament_group_teams(id, team:teams(id, name, colors))")
    .eq("tournament_id", id)
    .order("display_order")) as { data: any[] | null };

  // Fetch all teams in the zone for adding to groups
  const { data: zoneTeams } = await supabase
    .from("teams")
    .select("id, name")
    .eq("zone_id", tournament.zone_id)
    .order("name");

  // Fetch matches
  const { data: matches } = (await supabase
    .from("tournament_matches")
    .select("*, home_team:teams!tournament_matches_home_team_id_fkey(id, name), away_team:teams!tournament_matches_away_team_id_fkey(id, name), group:tournament_groups(id, name)")
    .eq("tournament_id", id)
    .order("journee")
    .order("created_at")) as { data: any[] | null };

  // Compute standings per group
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
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0,
          points: 0,
        };
      }

      for (const m of groupMatches) {
        if (m.home_score === null || m.away_score === null) continue;

        const home = standings[m.home_team_id];
        const away = standings[m.away_team_id];
        if (!home || !away) continue;

        home.played++;
        away.played++;
        home.goalsFor += m.home_score;
        home.goalsAgainst += m.away_score;
        away.goalsFor += m.away_score;
        away.goalsAgainst += m.home_score;

        if (m.home_score > m.away_score) {
          home.won++;
          home.points += 3;
          away.lost++;
        } else if (m.home_score < m.away_score) {
          away.won++;
          away.points += 3;
          home.lost++;
        } else {
          home.drawn++;
          away.drawn++;
          home.points += 1;
          away.points += 1;
        }

        home.goalDifference = home.goalsFor - home.goalsAgainst;
        away.goalDifference = away.goalsFor - away.goalsAgainst;
      }

      standingsByGroup[group.id] = Object.values(standings).sort(
        (a, b) =>
          b.points - a.points ||
          b.goalDifference - a.goalDifference ||
          b.goalsFor - a.goalsFor
      );
    }
  }

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
          <h1 className="text-2xl font-bold font-heading">
            {tournament.name}
          </h1>
          <p className="text-muted-foreground">Saison {tournament.season}</p>
        </div>
        <Badge
          variant="secondary"
          className={
            tournament.status === "en_cours"
              ? "bg-green-100 text-green-800"
              : "bg-gray-100 text-gray-800"
          }
        >
          {tournament.status === "en_cours" ? "En cours" : "Terminé"}
        </Badge>
      </div>

      <TournamentTabs
        poulesContent={
          <PoulesTab
            tournamentId={id}
            groups={groups || []}
            zoneTeams={zoneTeams || []}
          />
        }
        calendrierContent={
          <CalendrierTab
            tournamentId={id}
            matches={matches || []}
          />
        }
        classementsContent={
          <ClassementsTab
            groups={groups || []}
            standingsByGroup={standingsByGroup}
          />
        }
      />
    </div>
  );
}

"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createTournament(formData: {
  zoneId: string;
  name: string;
  season: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("tournaments").insert({
    zone_id: formData.zoneId,
    name: formData.name,
    season: formData.season,
  });
  if (error) return { error: error.message };
  revalidatePath("/programme");
  return { success: true };
}

export async function updateTournamentStatus(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tournaments")
    .update({ status })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/programme");
  return { success: true };
}

export async function createGroup(tournamentId: string, name: string, order: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("tournament_groups").insert({
    tournament_id: tournamentId,
    name,
    display_order: order,
  });
  if (error) return { error: error.message };
  revalidatePath(`/programme/${tournamentId}`);
  return { success: true };
}

export async function deleteGroup(groupId: string, tournamentId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tournament_groups")
    .delete()
    .eq("id", groupId);
  if (error) return { error: error.message };
  revalidatePath(`/programme/${tournamentId}`);
  return { success: true };
}

export async function addTeamToGroup(groupId: string, teamId: string, tournamentId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("tournament_group_teams").insert({
    group_id: groupId,
    team_id: teamId,
  });
  if (error) {
    if (error.code === "23505") return { error: "Équipe déjà dans cette poule" };
    return { error: error.message };
  }
  revalidatePath(`/programme/${tournamentId}`);
  return { success: true };
}

export async function removeTeamFromGroup(id: string, tournamentId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tournament_group_teams")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/programme/${tournamentId}`);
  return { success: true };
}

export async function generateGroupMatches(
  tournamentId: string,
  groupId: string,
  teamIds: string[]
) {
  const supabase = await createClient();

  // Generate round-robin matches
  const matches: {
    tournament_id: string;
    group_id: string;
    home_team_id: string;
    away_team_id: string;
    journee: number;
  }[] = [];

  let journee = 1;
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      matches.push({
        tournament_id: tournamentId,
        group_id: groupId,
        home_team_id: teamIds[i],
        away_team_id: teamIds[j],
        journee,
      });
      journee++;
    }
  }

  if (matches.length === 0) return { error: "Pas assez d'équipes" };

  const { error } = await supabase.from("tournament_matches").insert(matches);
  if (error) return { error: error.message };

  revalidatePath(`/programme/${tournamentId}`);
  return { success: true, count: matches.length };
}

export async function updateMatchResult(
  matchId: string,
  homeScore: number,
  awayScore: number,
  tournamentId: string
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tournament_matches")
    .update({
      home_score: homeScore,
      away_score: awayScore,
      status: "termine",
    })
    .eq("id", matchId);

  if (error) return { error: error.message };
  revalidatePath(`/programme/${tournamentId}`);
  return { success: true };
}

export async function updateTournamentMatch(
  matchId: string,
  data: { match_date?: string; venue?: string },
  tournamentId: string
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tournament_matches")
    .update(data)
    .eq("id", matchId);
  if (error) return { error: error.message };
  revalidatePath(`/programme/${tournamentId}`);
  return { success: true };
}

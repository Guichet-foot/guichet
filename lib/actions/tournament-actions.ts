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

export async function createTournamentMatch(formData: {
  tournamentId: string;
  groupId: string;
  homeTeamId: string;
  awayTeamId: string;
  journee: number;
  matchDate: string;
  venue: string;
  zoneId: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Non authentifié" };

  // Get team names for the billetterie match
  const { data: homeTeam } = await supabase
    .from("teams")
    .select("name")
    .eq("id", formData.homeTeamId)
    .single();

  const { data: awayTeam } = await supabase
    .from("teams")
    .select("name")
    .eq("id", formData.awayTeamId)
    .single();

  if (!homeTeam || !awayTeam) return { error: "Équipe introuvable" };

  // 1. Create match in billetterie (matches table)
  const { data: billetterieMatch, error: matchError } = await supabase
    .from("matches")
    .insert({
      zone_id: formData.zoneId,
      home_team: homeTeam.name,
      away_team: awayTeam.name,
      venue: formData.venue,
      match_date: formData.matchDate,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (matchError) return { error: matchError.message };

  // 2. Create match in tournament (tournament_matches table) linked to billetterie
  const { error: tmError } = await supabase
    .from("tournament_matches")
    .insert({
      tournament_id: formData.tournamentId,
      group_id: formData.groupId,
      home_team_id: formData.homeTeamId,
      away_team_id: formData.awayTeamId,
      journee: formData.journee,
      match_date: formData.matchDate,
      venue: formData.venue,
      match_id: billetterieMatch.id,
    });

  if (tmError) return { error: tmError.message };

  revalidatePath(`/programme/${formData.tournamentId}`);
  revalidatePath("/matchs");
  return { success: true };
}

export async function updateMatchResult(
  matchId: string,
  homeScore: number,
  awayScore: number,
  tournamentId: string
) {
  const supabase = await createClient();

  // Update tournament_match
  const { data: tm, error } = await supabase
    .from("tournament_matches")
    .update({
      home_score: homeScore,
      away_score: awayScore,
      status: "termine",
    })
    .eq("id", matchId)
    .select("match_id")
    .single();

  if (error) return { error: error.message };

  // Also update the linked billetterie match if it exists
  if (tm?.match_id) {
    await supabase
      .from("matches")
      .update({
        status: "termine",
        vente_active: false,
        home_score: homeScore,
        away_score: awayScore,
      })
      .eq("id", tm.match_id);
  }

  revalidatePath(`/programme/${tournamentId}`);
  revalidatePath("/matchs");
  return { success: true };
}

export async function deleteTournamentMatch(matchId: string, tournamentId: string) {
  const supabase = await createClient();

  // Get linked match_id before deleting
  const { data: tm } = await supabase
    .from("tournament_matches")
    .select("match_id")
    .eq("id", matchId)
    .single();

  const { error } = await supabase
    .from("tournament_matches")
    .delete()
    .eq("id", matchId);

  if (error) return { error: error.message };

  // Also delete the linked billetterie match if no tickets sold
  if (tm?.match_id) {
    const { count } = await supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("match_id", tm.match_id);

    if (!count || count === 0) {
      await supabase.from("matches").delete().eq("id", tm.match_id);
    }
  }

  revalidatePath(`/programme/${tournamentId}`);
  revalidatePath("/matchs");
  return { success: true };
}

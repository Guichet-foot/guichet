"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createTeam(formData: {
  zoneId: string;
  name: string;
  president: string;
  delegates: string[];
  colors: string;
}) {
  const supabase = await createClient();

  const { error } = await supabase.from("teams").insert({
    zone_id: formData.zoneId,
    name: formData.name,
    president: formData.president || null,
    delegates: formData.delegates.filter((d) => d.trim() !== ""),
    colors: formData.colors || null,
  });

  if (error) return { error: error.message };

  revalidatePath("/equipes");
  return { success: true };
}

export async function updateTeam(
  teamId: string,
  formData: {
    name: string;
    president: string;
    delegates: string[];
    colors: string;
  }
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("teams")
    .update({
      name: formData.name,
      president: formData.president || null,
      delegates: formData.delegates.filter((d) => d.trim() !== ""),
      colors: formData.colors || null,
    })
    .eq("id", teamId);

  if (error) return { error: error.message };

  revalidatePath("/equipes");
  return { success: true };
}

export async function deleteTeam(teamId: string) {
  const supabase = await createClient();
  const adminClient = await createAdminClient();

  // Supprimer les références tournoi avant de supprimer l'équipe
  await adminClient.from("tournament_group_teams").delete().eq("team_id", teamId);
  await adminClient
    .from("tournament_matches")
    .delete()
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`);

  const { error } = await supabase.from("teams").delete().eq("id", teamId);

  if (error) return { error: error.message };

  revalidatePath("/equipes");
  return { success: true };
}

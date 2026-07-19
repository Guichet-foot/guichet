"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function createTeam(formData: {
  zoneId: string;
  name: string;
  president: string;
  delegates: string[];
  colors: string;
}) {
  const profile = await requireRole(["super_admin", "admin_zone", "fondateur", "c3"]);

  if (profile.role === "c3") {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Non authentifié" };
    const adminClient = await createAdminClient();
    const { data: c3Profile } = await adminClient
      .from("profiles")
      .select("allowed_zones")
      .eq("id", user.id)
      .single();
    const allowed: string[] = c3Profile?.allowed_zones || [];
    if (!allowed.includes(formData.zoneId)) {
      return { error: "Accès refusé à cette zone" };
    }
  }

  const adminClient = await createAdminClient();
  const { error } = await adminClient.from("teams").insert({
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
  const profile = await requireRole(["super_admin", "admin_zone", "fondateur", "c3"]);

  const adminClient = await createAdminClient();

  if (profile.role === "c3") {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Non authentifié" };
    const { data: c3Profile } = await adminClient
      .from("profiles")
      .select("allowed_zones")
      .eq("id", user.id)
      .single();
    const allowed: string[] = c3Profile?.allowed_zones || [];
    const { data: team } = await adminClient.from("teams").select("zone_id").eq("id", teamId).single();
    if (!team || !allowed.includes(team.zone_id)) {
      return { error: "Accès refusé à cette équipe" };
    }
  }

  const { error } = await adminClient
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
  const profile = await requireRole(["super_admin", "admin_zone", "fondateur", "c3"]);

  const adminClient = await createAdminClient();

  if (profile.role === "c3") {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Non authentifié" };
    const { data: c3Profile } = await adminClient
      .from("profiles")
      .select("allowed_zones")
      .eq("id", user.id)
      .single();
    const allowed: string[] = c3Profile?.allowed_zones || [];
    const { data: team } = await adminClient.from("teams").select("zone_id").eq("id", teamId).single();
    if (!team || !allowed.includes(team.zone_id)) {
      return { error: "Accès refusé à cette équipe" };
    }
  }

  // Supprimer les références tournoi avant de supprimer l'équipe
  await adminClient.from("tournament_group_teams").delete().eq("team_id", teamId);
  await adminClient
    .from("tournament_matches")
    .delete()
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`);

  const { error } = await adminClient.from("teams").delete().eq("id", teamId);

  if (error) return { error: error.message };

  revalidatePath("/equipes");
  return { success: true };
}

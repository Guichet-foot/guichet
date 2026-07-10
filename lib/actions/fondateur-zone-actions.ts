"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireFondateur() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "fondateur") return null;
  return user;
}

export async function createZoneForOdcav(
  odcavId: string,
  name: string,
  region: string
): Promise<{ error?: string }> {
  const user = await requireFondateur();
  if (!user) return { error: "Non autorisé" };
  const adminClient = await createAdminClient();
  const { error } = await adminClient.from("zones").insert({
    name: name.trim(),
    region: region.trim() || null,
    created_by: odcavId,
  });
  if (error) return { error: error.message };
  revalidatePath(`/fondateur/super-admins/${odcavId}`);
  return {};
}

export async function updateZoneBasic(
  zoneId: string,
  odcavId: string,
  name: string,
  region: string
): Promise<{ error?: string }> {
  const user = await requireFondateur();
  if (!user) return { error: "Non autorisé" };
  const adminClient = await createAdminClient();
  const { error } = await adminClient.from("zones").update({
    name: name.trim(),
    region: region.trim() || null,
  }).eq("id", zoneId);
  if (error) return { error: error.message };
  revalidatePath(`/fondateur/super-admins/${odcavId}`);
  return {};
}

export async function deleteZoneComplete(zoneId: string): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (callerProfile?.role !== "fondateur") return { error: "Non autorisé" };

  const adminClient = await createAdminClient();

  // 1. Get all match IDs for this zone
  const { data: matches } = await adminClient
    .from("matches")
    .select("id")
    .eq("zone_id", zoneId);

  const matchIds = (matches || []).map((m: { id: string }) => m.id);

  if (matchIds.length > 0) {
    // 2. Delete tickets sold for these matches
    await adminClient.from("tickets").delete().in("match_id", matchIds);

    // 3. Delete ticket categories
    await adminClient.from("ticket_categories").delete().in("match_id", matchIds);

    // 4. Delete unsold declarations
    await adminClient.from("match_unsold").delete().in("match_id", matchIds);
  }

  // 5. Delete matches
  await adminClient.from("matches").delete().eq("zone_id", zoneId);

  // 6. Delete expenses
  await adminClient.from("expenses").delete().eq("zone_id", zoneId);

  // 7. Delete ticket templates
  await adminClient.from("ticket_templates").delete().eq("zone_id", zoneId);

  // 8. Supprimer les données de tournoi liées à cette zone
  const { data: tournaments } = await adminClient
    .from("tournaments")
    .select("id")
    .eq("zone_id", zoneId);

  const tournamentIds = (tournaments || []).map((t: { id: string }) => t.id);

  if (tournamentIds.length > 0) {
    const { data: groups } = await adminClient
      .from("tournament_groups")
      .select("id")
      .in("tournament_id", tournamentIds);

    const groupIds = (groups || []).map((g: { id: string }) => g.id);

    if (groupIds.length > 0) {
      await adminClient.from("tournament_group_teams").delete().in("group_id", groupIds);
    }

    await adminClient.from("tournament_matches").delete().in("tournament_id", tournamentIds);
    await adminClient.from("tournament_groups").delete().in("tournament_id", tournamentIds);
    await adminClient.from("tournaments").delete().in("id", tournamentIds);
  }

  // Aussi supprimer tournament_group_teams orphelins liés aux équipes de cette zone
  const { data: zoneTeams } = await adminClient
    .from("teams")
    .select("id")
    .eq("zone_id", zoneId);

  const teamIds = (zoneTeams || []).map((t: { id: string }) => t.id);
  if (teamIds.length > 0) {
    await adminClient.from("tournament_group_teams").delete().in("team_id", teamIds);
    await adminClient
      .from("tournament_matches")
      .delete()
      .or(teamIds.map((id: string) => `home_team_id.eq.${id},away_team_id.eq.${id}`).join(","));
  }

  // 9. Delete teams
  await adminClient.from("teams").delete().eq("zone_id", zoneId);

  // 10. Delete access cards
  await adminClient.from("access_cards").delete().eq("zone_id", zoneId);

  // 11. Delete zone member accounts (admin_zone, caissier, portier)
  const { data: zoneProfiles } = await adminClient
    .from("profiles")
    .select("id")
    .eq("zone_id", zoneId);

  const profileIds = (zoneProfiles || []).map((p: { id: string }) => p.id);

  if (profileIds.length > 0) {
    // Supprimer d'abord la référence auto-référentielle created_by_admin
    // (caissier/portier pointent vers admin_zone — FK bloque la suppression en masse)
    await adminClient
      .from("profiles")
      .update({ created_by_admin: null })
      .in("id", profileIds);

    // Supprimer les lignes profiles (enlève la FK zone_id → zones)
    await adminClient.from("profiles").delete().in("id", profileIds);

    // Supprimer les comptes auth
    for (const uid of profileIds) {
      await adminClient.auth.admin.deleteUser(uid);
    }
  }

  // 12. Delete the zone itself
  const { error } = await adminClient.from("zones").delete().eq("id", zoneId);
  if (error) return { error: error.message };

  revalidatePath("/fondateur/super-admins");
  revalidatePath(`/fondateur/super-admins`);
  return { success: true };
}

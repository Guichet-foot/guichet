"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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

  // 8. Delete teams
  await adminClient.from("teams").delete().eq("zone_id", zoneId);

  // 9. Delete access cards
  await adminClient.from("access_cards").delete().eq("zone_id", zoneId);

  // 10. Delete zone member accounts (admin_zone, caissier, portier) — auth user + profile
  const { data: zoneProfiles } = await adminClient
    .from("profiles")
    .select("id")
    .eq("zone_id", zoneId);

  if (zoneProfiles && zoneProfiles.length > 0) {
    for (const p of zoneProfiles as { id: string }[]) {
      // Delete from auth (may fail silently if already gone)
      await adminClient.auth.admin.deleteUser(p.id);
    }
  }

  // 11. Delete the zone itself
  const { error } = await adminClient.from("zones").delete().eq("id", zoneId);
  if (error) return { error: error.message };

  revalidatePath("/fondateur/super-admins");
  revalidatePath(`/fondateur/super-admins`);
  return { success: true };
}

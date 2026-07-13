"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ZoneMember } from "@/lib/types";

export async function createZone(formData: { name: string; region: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Non authentifié" };

  const { error } = await supabase.from("zones").insert({
    name: formData.name,
    region: formData.region || null,
    created_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/zones");
  return { success: true };
}

export async function updateZoneSettings(
  zoneId: string,
  formData: {
    name: string;
    region: string;
    logo: string;
    president: string;
    members: ZoneMember[];
    odcav: string;
    orcav: string;
    oncav: string;
  }
) {
  // Verify caller is authenticated and owns / belongs to this zone
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, zone_id")
    .eq("id", user.id)
    .single();

  if (!profile) return { error: "Profil introuvable" };

  const isOdcav = profile.role === "super_admin" || profile.role === "president_odcav" || profile.role === "fondateur";
  const isZoneMember = profile.role === "admin_zone" && profile.zone_id === zoneId;

  if (!isOdcav && !isZoneMember) return { error: "Non autorisé" };

  // Use admin client to bypass RLS (authorization already verified above)
  const adminClient = await createAdminClient();
  const { error } = await adminClient
    .from("zones")
    .update({
      name: formData.name,
      region: formData.region || null,
      logo: formData.logo || null,
      president: formData.president || null,
      members: formData.members.filter((m) => m.name.trim() !== ""),
      odcav: formData.odcav || null,
      orcav: formData.orcav || null,
      oncav: formData.oncav || null,
    })
    .eq("id", zoneId);

  if (error) return { error: error.message };

  revalidatePath("/parametres");
  revalidatePath("/zones");
  return { success: true };
}

export async function updateZone(
  zoneId: string,
  formData: { name: string; region: string }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const adminClient = await createAdminClient();
  const { error } = await adminClient
    .from("zones")
    .update({ name: formData.name, region: formData.region || null })
    .eq("id", zoneId);

  if (error) return { error: error.message };

  revalidatePath("/zones");
  return { success: true };
}

export async function deleteZone(zoneId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const adminClient = await createAdminClient();

  // Check for profiles linked to this zone
  const { count: profileCount } = await adminClient
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("zone_id", zoneId);

  if (profileCount && profileCount > 0) {
    return { error: "Impossible de supprimer : des utilisateurs sont rattachés à cette zone." };
  }

  // Check for matches
  const { count: matchCount } = await adminClient
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("zone_id", zoneId);

  if (matchCount && matchCount > 0) {
    return { error: "Impossible de supprimer : des matchs existent dans cette zone." };
  }

  const { error } = await adminClient.from("zones").delete().eq("id", zoneId);

  if (error) return { error: error.message };

  revalidatePath("/zones");
  return { success: true };
}

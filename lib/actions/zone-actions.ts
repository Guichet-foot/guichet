"use server";

import { createClient } from "@/lib/supabase/server";
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
    oncav: string;
  }
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("zones")
    .update({
      name: formData.name,
      region: formData.region || null,
      logo: formData.logo || null,
      president: formData.president || null,
      members: formData.members.filter((m) => m.name.trim() !== ""),
      odcav: formData.odcav || null,
      oncav: formData.oncav || null,
    })
    .eq("id", zoneId);

  if (error) return { error: error.message };

  revalidatePath("/parametres");
  revalidatePath("/zones");
  return { success: true };
}

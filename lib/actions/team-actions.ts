"use server";

import { createClient } from "@/lib/supabase/server";
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

  const { error } = await supabase.from("teams").delete().eq("id", teamId);

  if (error) return { error: error.message };

  revalidatePath("/equipes");
  return { success: true };
}

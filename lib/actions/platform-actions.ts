"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getPlatformSettingsForDate(date: string) {
  const supabase = await createAdminClient();
  const { data } = await supabase
    .from("platform_settings")
    .select("frais_plateforme, odcav_rate, effective_date")
    .lte("effective_date", date)
    .order("effective_date", { ascending: false })
    .limit(1)
    .single();
  return data || { frais_plateforme: 5000, odcav_rate: 0.05, effective_date: date };
}

export async function updatePlatformFee(fraisPlateforme: number, effectiveDate: string) {
  await requireRole(["fondateur"]);
  const supabase = await createAdminClient();

  const { error } = await supabase.from("platform_settings").upsert(
    { frais_plateforme: fraisPlateforme, odcav_rate: 0.05, effective_date: effectiveDate },
    { onConflict: "effective_date" }
  );

  if (error) return { error: error.message };
  revalidatePath("/fondateur/parametres");
  return { success: true };
}

export async function getPlatformHistory() {
  await requireRole(["fondateur"]);
  const supabase = await createAdminClient();
  const { data } = await supabase
    .from("platform_settings")
    .select("*")
    .order("effective_date", { ascending: false });
  return data || [];
}

"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createZone(formData: { name: string; region: string }) {
  const supabase = await createClient();

  const { error } = await supabase.from("zones").insert({
    name: formData.name,
    region: formData.region || null,
  });

  if (error) return { error: error.message };

  revalidatePath("/zones");
  return { success: true };
}

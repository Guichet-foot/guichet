"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface OdcavMember {
  name: string;
  poste: string;
}

export interface OdcavSettings {
  logoUrl: string;
  nom: string;
  adresse: string;
  president: string;
  telephone: string;
  email: string;
  membres: OdcavMember[];
}

export async function getOdcavSettings(): Promise<OdcavSettings> {
  const supabase = await createAdminClient();
  const { data } = await supabase
    .from("odcav_settings")
    .select("*")
    .eq("id", "global")
    .single();

  return {
    logoUrl: data?.logo_url || "",
    nom: data?.nom || "",
    adresse: data?.adresse || "",
    president: data?.president || "",
    telephone: data?.telephone || "",
    email: data?.email || "",
    membres: data?.membres || [],
  };
}

export async function updateOdcavSettings(settings: OdcavSettings) {
  await requireRole(["super_admin", "fondateur"]);
  const supabase = await createClient();
  const { error } = await supabase.from("odcav_settings").upsert(
    {
      id: "global",
      logo_url: settings.logoUrl,
      nom: settings.nom,
      adresse: settings.adresse,
      president: settings.president,
      telephone: settings.telephone,
      email: settings.email,
      membres: settings.membres,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) return { error: error.message };
  revalidatePath("/parametres-odcav");
  return { success: true };
}

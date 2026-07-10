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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const adminClient = await createAdminClient();
  // Sub-admins (super_admin/tresorier created by a president) share the parent's settings row
  let rowId = user?.id ?? "global";
  if (user) {
    const { data: prof } = await adminClient.from("profiles").select("created_by_admin").eq("id", user.id).maybeSingle();
    if (prof?.created_by_admin) rowId = prof.created_by_admin;
  }
  const { data } = await adminClient
    .from("odcav_settings")
    .select("*")
    .eq("id", rowId)
    .maybeSingle();

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
  const profile = await requireRole(["super_admin", "fondateur", "c3"]);
  const supabase = await createClient();
  const adminClient = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const { error } = await adminClient.from("odcav_settings").upsert(
    {
      id: user.id,
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
  if (profile.role === "c3") {
    revalidatePath("/parametres-c3");
  } else {
    revalidatePath("/parametres-odcav");
  }
  return { success: true };
}

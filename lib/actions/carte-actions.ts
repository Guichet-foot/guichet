"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { AccessCard } from "@/lib/types";

export async function createAccessCard(data: {
  full_name: string;
  phone: string;
  zone_id: string;
  zone_name: string;
  poste: string;
  asc_name?: string;
  photo_url?: string;
}): Promise<{ card?: AccessCard; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, zone_id")
    .eq("id", user.id)
    .single();

  if (!profile || !["super_admin", "admin_zone", "fondateur"].includes(profile.role)) {
    return { error: "Non autorisé" };
  }
  if (profile.role === "admin_zone" && profile.zone_id !== data.zone_id) {
    return { error: "Vous ne pouvez créer des cartes que pour votre zone" };
  }

  const adminClient = await createAdminClient();
  const { data: card, error } = await adminClient
    .from("access_cards")
    .insert({ ...data, created_by: user.id })
    .select()
    .single();

  if (error) return { error: error.message };
  return { card: card as AccessCard };
}

export async function getAccessCards(zoneId?: string): Promise<AccessCard[]> {
  const adminClient = await createAdminClient();
  let query = adminClient
    .from("access_cards")
    .select("*")
    .order("created_at", { ascending: false });
  if (zoneId) query = query.eq("zone_id", zoneId);
  const { data } = await query;
  return (data || []) as AccessCard[];
}

export async function getAccessCard(id: string): Promise<AccessCard | null> {
  const adminClient = await createAdminClient();
  const { data } = await adminClient
    .from("access_cards")
    .select("*")
    .eq("id", id)
    .single();
  return data as AccessCard | null;
}

export async function getCardByQRToken(token: string): Promise<AccessCard | null> {
  const adminClient = await createAdminClient();
  const { data } = await adminClient
    .from("access_cards")
    .select("*")
    .eq("qr_token", token)
    .maybeSingle();
  return data as AccessCard | null;
}

export async function deleteAccessCard(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["super_admin", "admin_zone", "fondateur"].includes(profile.role)) {
    return { error: "Non autorisé" };
  }

  const adminClient = await createAdminClient();
  const { error } = await adminClient
    .from("access_cards")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  return {};
}

export async function ensureCardPhotosBucket(): Promise<{ error?: string }> {
  const adminClient = await createAdminClient();
  const { data: buckets } = await adminClient.storage.listBuckets();
  const exists = (buckets || []).some((b: any) => b.name === "card-photos");
  if (!exists) {
    const { error } = await adminClient.storage.createBucket("card-photos", {
      public: true,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      fileSizeLimit: 5 * 1024 * 1024,
    });
    if (error) return { error: error.message };
  }
  return {};
}

export async function getZoneTeamsForCard(zoneId: string): Promise<{ id: string; name: string }[]> {
  const adminClient = await createAdminClient();
  const { data } = await adminClient
    .from("teams")
    .select("id, name")
    .eq("zone_id", zoneId)
    .order("name");
  return (data || []) as { id: string; name: string }[];
}

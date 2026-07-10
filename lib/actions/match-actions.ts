"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { MatchStatus } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Charge les équipes et zones d'un compte C3 via adminClient (bypass RLS).
 * Le client Supabase user est bloqué par RLS car C3 n'a pas de zone_id.
 */
export async function getC3TeamsAndZones(): Promise<{
  teams: { id: string; name: string; zone_id: string }[];
  zones: { id: string; name: string }[];
  allowedZones: string[];
}> {
  const supabase = await createClient();
  const adminClient = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { teams: [], zones: [], allowedZones: [] };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, allowed_zones")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "c3") return { teams: [], zones: [], allowedZones: [] };

  const allowedZones: string[] = (profile.allowed_zones as string[] | null) ?? [];
  if (allowedZones.length === 0) return { teams: [], zones: [], allowedZones: [] };

  const [{ data: zoneList }, { data: teamList }] = await Promise.all([
    adminClient.from("zones").select("id, name").in("id", allowedZones).order("name"),
    adminClient.from("teams").select("id, name, zone_id").in("zone_id", allowedZones).order("name"),
  ]);

  return {
    zones: (zoneList || []) as { id: string; name: string }[],
    teams: (teamList || []) as { id: string; name: string; zone_id: string }[],
    allowedZones,
  };
}

/**
 * Zones de l'admin courant (ou de son parent) — bypass RLS via adminClient.
 * Utilisé dans les formulaires client qui ont besoin des zones ODCAV.
 */
export async function getAdminZonesForForm(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const adminClient = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, created_by_admin")
    .eq("id", user.id)
    .single();

  if (!profile) return [];

  const odcavRoles = ["super_admin", "president_odcav", "tresorier", "fondateur"];
  if (!odcavRoles.includes(profile.role)) return [];

  // Sub-admins use their parent's zones
  const ownerId = profile.created_by_admin ?? user.id;

  if (profile.role === "fondateur") {
    const { data } = await adminClient.from("zones").select("id, name").order("name");
    return (data || []) as { id: string; name: string }[];
  }

  const { data } = await adminClient
    .from("zones")
    .select("id, name")
    .eq("created_by", ownerId)
    .order("name");
  return (data || []) as { id: string; name: string }[];
}

/**
 * Équipes d'une zone — bypass RLS via adminClient.
 * Utilisé dans les formulaires client (match zone, equipes).
 */
export async function getTeamsForZone(zoneId: string): Promise<{ id: string; name: string }[]> {
  const adminClient = await createAdminClient();
  const { data } = await adminClient
    .from("teams")
    .select("id, name")
    .eq("zone_id", zoneId)
    .order("name");
  return (data || []) as { id: string; name: string }[];
}

/**
 * Templates de billets d'une zone — bypass RLS via adminClient.
 */
export async function getTicketTemplatesForZone(zoneId: string): Promise<{
  id: string; name: string; price: number; default_quantity: number; color: string;
}[]> {
  const adminClient = await createAdminClient();
  const { data } = await adminClient
    .from("ticket_templates")
    .select("id, name, price, default_quantity, color")
    .eq("zone_id", zoneId)
    .order("price");
  return (data || []) as { id: string; name: string; price: number; default_quantity: number; color: string }[];
}

export async function createMatch(formData: {
  zoneId?: string | null;
  c3AccountId?: string | null;
  homeTeam: string;
  awayTeam: string;
  venue: string;
  matchDate: string;
  notes: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const { data: match, error } = await supabase
    .from("matches")
    .insert({
      zone_id: formData.zoneId || null,
      c3_account_id: formData.c3AccountId || null,
      home_team: formData.homeTeam,
      away_team: formData.awayTeam,
      venue: formData.venue,
      match_date: formData.matchDate,
      notes: formData.notes || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/matchs");
  return { success: true, matchId: match.id };
}

export async function updateMatchStatus(
  matchId: string,
  status: MatchStatus,
  scores?: { homeScore: number; awayScore: number }
) {
  const supabase = await createClient();

  const updateData: Record<string, unknown> = { status };
  if (status === "termine" || status === "annule") {
    updateData.vente_active = false;
  }
  if (scores) {
    updateData.home_score = scores.homeScore;
    updateData.away_score = scores.awayScore;
  }

  const { error } = await supabase
    .from("matches")
    .update(updateData)
    .eq("id", matchId);

  if (error) return { error: error.message };

  revalidatePath("/matchs");
  revalidatePath(`/matchs/${matchId}`);
  return { success: true };
}

export async function upsertTicketCategory(formData: {
  id?: string;
  matchId: string;
  name: string;
  price: number;
  displayOrder: number;
}) {
  const supabase = await createClient();

  if (formData.id) {
    const { error } = await supabase
      .from("ticket_categories")
      .update({
        name: formData.name,
        price: formData.price,
        quantity_total: 999999,
        display_order: formData.displayOrder,
      })
      .eq("id", formData.id);

    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("ticket_categories").insert({
      match_id: formData.matchId,
      name: formData.name,
      price: formData.price,
      quantity_total: 999999,
      display_order: formData.displayOrder,
      active: true,
    });

    if (error) return { error: error.message };
  }

  revalidatePath(`/matchs/${formData.matchId}/billets`);
  revalidatePath(`/matchs/${formData.matchId}`);
  return { success: true };
}

export async function deleteTicketCategory(categoryId: string, matchId: string) {
  const supabase = await createClient();

  const { count } = await supabase
    .from("tickets")
    .select("*", { count: "exact", head: true })
    .eq("category_id", categoryId);

  if (count && count > 0) {
    return { error: "Impossible de supprimer : des billets ont été vendus" };
  }

  const { error } = await supabase
    .from("ticket_categories")
    .delete()
    .eq("id", categoryId);

  if (error) return { error: error.message };

  revalidatePath(`/matchs/${matchId}/billets`);
  return { success: true };
}

export async function updateMatch(matchId: string, formData: {
  homeTeam: string;
  awayTeam: string;
  venue: string;
  matchDate: string;
  notes: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const { error } = await supabase
    .from("matches")
    .update({
      home_team: formData.homeTeam,
      away_team: formData.awayTeam,
      venue: formData.venue,
      match_date: formData.matchDate,
      notes: formData.notes || null,
    })
    .eq("id", matchId);

  if (error) return { error: error.message };

  revalidatePath("/matchs");
  revalidatePath(`/matchs/${matchId}`);
  return { success: true };
}

export async function deleteMatch(matchId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const adminClient = await createAdminClient();

  const { count } = await adminClient
    .from("tickets")
    .select("*", { count: "exact", head: true })
    .eq("match_id", matchId);

  if (count && count > 0) {
    return { error: `Impossible de supprimer : ${count} billet(s) ont été émis pour ce match` };
  }

  const { error } = await adminClient.from("matches").delete().eq("id", matchId);
  if (error) return { error: error.message };

  revalidatePath("/matchs");
  return {};
}

export async function toggleMatchVente(matchId: string, venteActive: boolean) {
  const supabase = await createClient();

  const updateData: Record<string, unknown> = { vente_active: venteActive };
  if (venteActive) {
    updateData.status = "en_cours";
  }

  const { error } = await supabase
    .from("matches")
    .update(updateData)
    .eq("id", matchId);

  if (error) return { error: error.message };

  revalidatePath("/matchs");
  revalidatePath(`/matchs/${matchId}`);
  return { success: true };
}

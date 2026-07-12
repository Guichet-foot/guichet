"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
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
  await requireRole(["fondateur", "super_admin", "admin_zone", "c3", "president_odcav"]);
  const adminClient = await createAdminClient();

  const updateData: Record<string, unknown> = { status };
  if (status === "termine" || status === "annule") {
    updateData.vente_active = false;
  }
  if (scores) {
    updateData.home_score = scores.homeScore;
    updateData.away_score = scores.awayScore;
  }

  const { error } = await adminClient
    .from("matches")
    .update(updateData)
    .eq("id", matchId);

  if (error) return { error: error.message };

  revalidatePath("/matchs");
  revalidatePath(`/matchs/${matchId}`);
  revalidatePath("/matchs/communaux");
  revalidatePath("/matchs/departementaux");
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

  const adminClient = await createAdminClient();
  const { error } = await adminClient
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

  const { data: match } = await adminClient
    .from("matches")
    .select("status")
    .eq("id", matchId)
    .single();

  if (!match) return { error: "Match introuvable" };

  // Only block deletion of matches currently in progress
  if (match.status === "en_cours") {
    return { error: "Impossible de supprimer un match en cours" };
  }

  // Step 1 — find all ticket_categories for this match
  const { data: cats } = await adminClient
    .from("ticket_categories")
    .select("id")
    .eq("match_id", matchId);

  const catIds = (cats || []).map((c: { id: string }) => c.id);

  // Step 2 — delete ALL tickets referencing these categories (regardless of match_id)
  if (catIds.length > 0) {
    const { error: tickCatErr } = await adminClient
      .from("tickets")
      .delete()
      .in("category_id", catIds);
    if (tickCatErr) return { error: tickCatErr.message };
  }

  // Step 3 — delete any remaining tickets linked to this match directly (null category_id, etc.)
  const { error: tickErr } = await adminClient.from("tickets").delete().eq("match_id", matchId);
  if (tickErr) return { error: tickErr.message };

  // Step 4 — delete ticket_categories (now safe, no tickets reference them)
  const { error: catErr } = await adminClient.from("ticket_categories").delete().eq("match_id", matchId);
  if (catErr) return { error: catErr.message };

  // Step 5 — delete the match
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

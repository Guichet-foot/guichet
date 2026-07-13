"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/* eslint-disable @typescript-eslint/no-explicit-any */

async function getOdcavUser() {
  // Also allows president_odcav + tresorier (requireRole auto-expansion) + fondateur
  const profile = await requireRole(["super_admin", "fondateur"]);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return { user, profile };
}

// Returns all ODCAV president accounts created by the current fondateur
export async function getFondateurOdcavAccounts(): Promise<{
  id: string;
  name: string | null;
}[]> {
  const profile = await requireRole(["fondateur"]);
  const adminClient = await createAdminClient();
  const { data } = await adminClient
    .from("profiles")
    .select("id, full_name")
    .in("role", ["president_odcav", "super_admin"])
    .eq("created_by_admin", profile.id)
    .eq("active", true)
    .order("full_name");
  return (data || []).map((p: any) => ({ id: p.id as string, name: p.full_name as string | null }));
}

// Returns all teams from zones owned by the given ODCAV president
export async function getTeamsForOdcav(odcavId: string): Promise<{
  id: string;
  name: string;
  zone_id: string;
  zone_name: string;
}[]> {
  await requireRole(["fondateur"]);
  const adminClient = await createAdminClient();
  const { data: zones } = await adminClient
    .from("zones")
    .select("id, name")
    .eq("created_by", odcavId)
    .order("name");
  if (!zones || zones.length === 0) return [];
  const zoneIds = zones.map((z: any) => z.id as string);
  const { data: teams } = await adminClient
    .from("teams")
    .select("id, name, zone_id")
    .in("zone_id", zoneIds)
    .order("name");
  if (!teams) return [];
  const zoneMap = new Map(zones.map((z: any) => [z.id as string, z.name as string]));
  return teams.map((t: any) => ({
    id: t.id as string,
    name: t.name as string,
    zone_id: t.zone_id as string,
    zone_name: zoneMap.get(t.zone_id) ?? "",
  }));
}

// Returns all teams across all zones owned by this ODCAV admin (or parent admin)
export async function getOdcavTeamsWithZones(): Promise<{
  id: string; name: string; zone_id: string; zone_name: string;
}[]> {
  const ctx = await getOdcavUser();
  if (!ctx) return [];
  const adminClient = await createAdminClient();

  let zones: { id: string; name: string }[] = [];

  if (ctx.profile.role === "fondateur") {
    const { data } = await adminClient.from("zones").select("id, name").order("name");
    zones = (data || []) as { id: string; name: string }[];
  } else {
    const ownerId =
      (ctx.profile.role === "super_admin" || ctx.profile.role === "tresorier")
        ? (ctx.profile.created_by_admin ?? ctx.profile.id)
        : ctx.profile.id;
    const { data } = await adminClient.from("zones").select("id, name").eq("created_by", ownerId).order("name");
    zones = (data || []) as { id: string; name: string }[];
  }

  if (zones.length === 0) return [];
  const zoneIds = zones.map((z) => z.id);

  const { data: teams } = await adminClient.from("teams").select("id, name, zone_id").in("zone_id", zoneIds).order("name");
  if (!teams) return [];

  const zoneMap = new Map(zones.map((z) => [z.id, z.name]));
  return teams.map((t: any) => ({
    id: t.id as string,
    name: t.name as string,
    zone_id: t.zone_id as string,
    zone_name: zoneMap.get(t.zone_id) ?? "",
  }));
}

// Create a communal or departmental match (is_direct, zone_id=null, match_type set)
export async function createOdcavInterMatch(formData: {
  homeTeam: string;
  homeTeamZone: string;
  awayTeam: string;
  awayTeamZone: string;
  matchType: "Match Communal" | "Match Départemental";
  venue: string;
  matchDate: string;
  notes: string;
  inlineCategories?: { name: string; price: number }[];
  odcavId?: string; // When fondateur creates, sets created_by to this ODCAV's ID
}) {
  const ctx = await getOdcavUser();
  if (!ctx) return { error: "Non autorisé" };

  const adminClient = await createAdminClient();
  const { data: match, error } = await adminClient
    .from("matches")
    .insert({
      zone_id: null,
      home_team: formData.homeTeam,
      home_team_zone: formData.homeTeamZone || null,
      away_team: formData.awayTeam,
      away_team_zone: formData.awayTeamZone || null,
      match_type: formData.matchType,
      venue: formData.venue,
      match_date: formData.matchDate,
      notes: formData.notes || null,
      created_by: formData.odcavId ?? ctx.user.id,
      is_direct: true,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (formData.inlineCategories && formData.inlineCategories.length > 0) {
    const cats = formData.inlineCategories.map((c, i) => ({
      match_id: match.id,
      name: c.name,
      price: c.price,
      quantity_total: 10000,
      display_order: i,
      active: true,
    }));
    await adminClient.from("ticket_categories").insert(cats);
  }

  revalidatePath("/matchs");
  revalidatePath("/fondateur/matchs");
  return { success: true, matchId: match.id };
}

// List communal or departmental matches for the current ODCAV admin / fondateur.
// C3 matches (c3_account_id IS NOT NULL) are treated as communal regardless of match_type.
export async function getOdcavInterMatches(matchType: "Match Communal" | "Match Départemental"): Promise<any[]> {
  const ctx = await getOdcavUser();
  if (!ctx) return [];
  const adminClient = await createAdminClient();

  let results: any[] = [];

  if (ctx.profile.role === "fondateur") {
    const { data: odcavData } = await adminClient
      .from("matches")
      .select("*")
      .eq("match_type", matchType)
      .eq("is_direct", true)
      .order("match_date", { ascending: false });
    results = [...(odcavData || [])];

    if (matchType === "Match Communal") {
      const { data: c3Profiles } = await adminClient
        .from("profiles")
        .select("id, full_name")
        .eq("role", "c3");
      const c3NameMap = new Map((c3Profiles || []).map((p: any) => [p.id as string, (p.full_name as string) ?? "C3"]));

      const { data: c3Data } = await adminClient
        .from("matches")
        .select("*")
        .not("c3_account_id", "is", null)
        .order("match_date", { ascending: false });
      results = [...results, ...(c3Data || []).map((m: any) => ({
        ...m,
        c3_name: c3NameMap.get(m.c3_account_id as string) ?? "C3",
      }))];
    }
  } else {
    // super_admin/tresorier are sub-accounts — inherit parent's identity.
    const ownerId =
      (ctx.profile.role === "super_admin" || ctx.profile.role === "tresorier")
        ? (ctx.profile.created_by_admin ?? ctx.profile.id)
        : ctx.profile.id;

    const { data: subAdmins } = await adminClient
      .from("profiles")
      .select("id")
      .eq("created_by_admin", ownerId);
    const creatorIds = [ownerId, ...(subAdmins || []).map((p: any) => p.id as string)];

    const { data: odcavData } = await adminClient
      .from("matches")
      .select("*")
      .eq("match_type", matchType)
      .eq("is_direct", true)
      .in("created_by", creatorIds)
      .order("match_date", { ascending: false });
    results = [...(odcavData || [])];

    if (matchType === "Match Communal") {
      const { data: c3Accounts } = await adminClient
        .from("profiles")
        .select("id, full_name")
        .eq("role", "c3")
        .eq("created_by_admin", ownerId);

      if (c3Accounts && c3Accounts.length > 0) {
        const c3Ids = c3Accounts.map((p: any) => p.id as string);
        const c3NameMap = new Map(c3Accounts.map((p: any) => [p.id as string, (p.full_name as string) ?? "C3"]));

        const { data: c3Data } = await adminClient
          .from("matches")
          .select("*")
          .in("c3_account_id", c3Ids)
          .order("match_date", { ascending: false });
        results = [...results, ...(c3Data || []).map((m: any) => ({
          ...m,
          c3_name: c3NameMap.get(m.c3_account_id as string) ?? "C3",
        }))];
      }
    }
  }

  // Deduplicate and sort by match_date desc
  const seen = new Set<string>();
  return results
    .filter((m) => { const k = m.id as string; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => new Date(b.match_date as string).getTime() - new Date(a.match_date as string).getTime());
}

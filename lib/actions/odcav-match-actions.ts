"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/* eslint-disable @typescript-eslint/no-explicit-any */

async function getOdcavUser() {
  const profile = await requireRole(["super_admin"]);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return { user, profile };
}

// Returns all teams across all zones owned by this ODCAV admin (or parent admin)
export async function getOdcavTeamsWithZones(): Promise<{
  id: string; name: string; zone_id: string; zone_name: string;
}[]> {
  const ctx = await getOdcavUser();
  if (!ctx) return [];
  const adminClient = await createAdminClient();
  const ownerId = ctx.profile.created_by_admin ?? ctx.profile.id;

  const { data: zones } = await adminClient.from("zones").select("id, name").eq("created_by", ownerId).order("name");
  if (!zones || zones.length === 0) return [];
  const zoneIds = zones.map((z: any) => z.id as string);

  const { data: teams } = await adminClient.from("teams").select("id, name, zone_id").in("zone_id", zoneIds).order("name");
  if (!teams) return [];

  const zoneMap = new Map(zones.map((z: any) => [z.id as string, z.name as string]));
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
      created_by: ctx.user.id,
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
  return { success: true, matchId: match.id };
}

// List communal or departmental matches created by this admin (or parent admin)
export async function getOdcavInterMatches(matchType: "Match Communal" | "Match Départemental"): Promise<any[]> {
  const ctx = await getOdcavUser();
  if (!ctx) return [];
  const adminClient = await createAdminClient();

  // Find all possible creator IDs: self and sub-admins whose created_by_admin = ownerId
  const ownerId = ctx.profile.created_by_admin ?? ctx.profile.id;

  // Fetch sub-admins of this ODCAV to also include their matches
  const { data: subAdmins } = await adminClient
    .from("profiles")
    .select("id")
    .eq("created_by_admin", ownerId);
  const creatorIds = [ownerId, ...(subAdmins || []).map((p: any) => p.id as string)];

  const { data } = await adminClient
    .from("matches")
    .select("*")
    .eq("match_type", matchType)
    .eq("is_direct", true)
    .in("created_by", creatorIds)
    .order("match_date", { ascending: false });

  return (data || []) as any[];
}

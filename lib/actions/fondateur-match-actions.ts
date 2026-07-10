"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function getFondateur() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "fondateur") return null;
  return user;
}

async function createCategories(
  adminClient: Awaited<ReturnType<typeof createAdminClient>>,
  matchId: string,
  selectedTemplateIds: string[],
  inlineCategories: { name: string; price: number }[]
) {
  const cats: { match_id: string; name: string; price: number; quantity_total: number; display_order: number; active: boolean }[] = [];
  let order = 0;

  if (selectedTemplateIds.length > 0) {
    const { data: templates } = await adminClient
      .from("ticket_templates")
      .select("name, price")
      .in("id", selectedTemplateIds);
    for (const t of templates || []) {
      cats.push({ match_id: matchId, name: t.name, price: t.price, quantity_total: 999999, display_order: order++, active: true });
    }
  }

  for (const c of inlineCategories) {
    cats.push({ match_id: matchId, name: c.name, price: c.price, quantity_total: 999999, display_order: order++, active: true });
  }

  if (cats.length > 0) {
    await adminClient.from("ticket_categories").insert(cats);
  }
}

export async function createMatchAsFondateur(formData: {
  zoneId: string;
  homeTeam: string;
  awayTeam: string;
  venue: string;
  matchDate: string;
  notes: string;
  selectedTemplateIds?: string[];
  inlineCategories?: { name: string; price: number }[];
}) {
  const user = await getFondateur();
  if (!user) return { error: "Non autorisé" };

  const adminClient = await createAdminClient();
  const { data: match, error } = await adminClient
    .from("matches")
    .insert({
      zone_id: formData.zoneId,
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

  await createCategories(
    adminClient,
    match.id,
    formData.selectedTemplateIds || [],
    formData.inlineCategories || []
  );

  revalidatePath("/fondateur/matchs");
  revalidatePath(`/fondateur/matchs/${formData.zoneId}`);
  return { success: true, matchId: match.id };
}

export async function createDirectMatch(formData: {
  homeTeam: string;
  homeTeamZone: string;
  awayTeam: string;
  awayTeamZone: string;
  matchType: string;
  venue: string;
  matchDate: string;
  notes: string;
  inlineCategories?: { name: string; price: number }[];
}) {
  const user = await getFondateur();
  if (!user) return { error: "Non autorisé" };

  const adminClient = await createAdminClient();
  const { data: match, error } = await adminClient
    .from("matches")
    .insert({
      zone_id: null,
      home_team: formData.homeTeam,
      home_team_zone: formData.homeTeamZone || null,
      away_team: formData.awayTeam,
      away_team_zone: formData.awayTeamZone || null,
      match_type: formData.matchType || null,
      venue: formData.venue,
      match_date: formData.matchDate,
      notes: formData.notes || null,
      created_by: user.id,
      is_direct: true,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await createCategories(adminClient, match.id, [], formData.inlineCategories || []);

  revalidatePath("/fondateur/matchs");
  return { success: true, matchId: match.id };
}

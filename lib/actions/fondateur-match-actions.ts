"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { MatchStatus } from "@/lib/types";

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

export async function updateMatchAsFondateur(
  matchId: string,
  formData: { homeTeam: string; awayTeam: string; venue: string; matchDate: string; notes: string }
) {
  const user = await getFondateur();
  if (!user) return { error: "Non autorisé" };

  const adminClient = await createAdminClient();
  const { data: match } = await adminClient
    .from("matches")
    .select("zone_id")
    .eq("id", matchId)
    .single();

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

  revalidatePath("/fondateur/matchs");
  if (match?.zone_id) revalidatePath(`/fondateur/matchs/${match.zone_id}`);
  return { success: true };
}

export async function updateMatchStatusAsFondateur(matchId: string, status: MatchStatus) {
  const user = await getFondateur();
  if (!user) return { error: "Non autorisé" };

  const adminClient = await createAdminClient();
  const { data: match } = await adminClient
    .from("matches")
    .select("zone_id")
    .eq("id", matchId)
    .single();

  const updateData: Record<string, unknown> = { status };
  if (status === "termine" || status === "annule") {
    updateData.vente_active = false;
  }

  const { error } = await adminClient
    .from("matches")
    .update(updateData)
    .eq("id", matchId);

  if (error) return { error: error.message };

  revalidatePath("/fondateur/matchs");
  if (match?.zone_id) revalidatePath(`/fondateur/matchs/${match.zone_id}`);
  return { success: true };
}

export async function deleteMatchAsFondateur(matchId: string) {
  const user = await getFondateur();
  if (!user) return { error: "Non autorisé" };

  const adminClient = await createAdminClient();
  const { data: match } = await adminClient
    .from("matches")
    .select("status, zone_id")
    .eq("id", matchId)
    .single();

  if (!match) return { error: "Match introuvable" };
  if (match.status === "en_cours") return { error: "Impossible de supprimer un match en cours" };

  const zoneId = match.zone_id;

  const { data: cats } = await adminClient
    .from("ticket_categories")
    .select("id")
    .eq("match_id", matchId);

  const catIds = (cats || []).map((c: { id: string }) => c.id);

  if (catIds.length > 0) {
    const { error: tickCatErr } = await adminClient
      .from("tickets")
      .delete()
      .in("category_id", catIds);
    if (tickCatErr) return { error: tickCatErr.message };
  }

  const { error: tickErr } = await adminClient.from("tickets").delete().eq("match_id", matchId);
  if (tickErr) return { error: tickErr.message };

  const { error: catErr } = await adminClient.from("ticket_categories").delete().eq("match_id", matchId);
  if (catErr) return { error: catErr.message };

  const { error } = await adminClient.from("matches").delete().eq("id", matchId);
  if (error) return { error: error.message };

  revalidatePath("/fondateur/matchs");
  if (zoneId) revalidatePath(`/fondateur/matchs/${zoneId}`);
  return { success: true };
}

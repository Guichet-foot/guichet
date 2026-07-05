"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { MatchStatus } from "@/lib/types";

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
  quantityTotal: number;
  displayOrder: number;
}) {
  const supabase = await createClient();

  if (formData.id) {
    const { error } = await supabase
      .from("ticket_categories")
      .update({
        name: formData.name,
        price: formData.price,
        quantity_total: formData.quantityTotal,
        display_order: formData.displayOrder,
      })
      .eq("id", formData.id);

    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("ticket_categories").insert({
      match_id: formData.matchId,
      name: formData.name,
      price: formData.price,
      quantity_total: formData.quantityTotal,
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

export async function toggleMatchVente(matchId: string, venteActive: boolean) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("matches")
    .update({ vente_active: venteActive })
    .eq("id", matchId);

  if (error) return { error: error.message };

  revalidatePath("/matchs");
  revalidatePath(`/matchs/${matchId}`);
  return { success: true };
}

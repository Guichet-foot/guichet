"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createMatchAsFondateur(formData: {
  zoneId: string;
  homeTeam: string;
  awayTeam: string;
  venue: string;
  matchDate: string;
  notes: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "fondateur") return { error: "Non autorisé" };

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

  revalidatePath("/fondateur/matchs");
  revalidatePath(`/fondateur/matchs/${formData.zoneId}`);
  return { success: true, matchId: match.id };
}

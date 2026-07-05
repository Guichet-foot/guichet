"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getFinishedMatches() {
  const profile = await requireRole(["super_admin", "admin_zone", "fondateur"]);
  const adminClient = await createAdminClient();

  let query = adminClient
    .from("matches")
    .select("id, home_team, away_team, match_date, venue, zone_id, zone:zones!matches_zone_id_fkey(name)")
    .eq("status", "termine")
    .order("match_date", { ascending: false });

  if (profile.role === "admin_zone") {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data: prof } = await supabase
      .from("profiles")
      .select("zone_id")
      .eq("id", user.id)
      .single();
    if (prof?.zone_id) query = query.eq("zone_id", prof.zone_id as string);
    else return [];
  } else if (profile.role === "super_admin") {
    // Scope to zones owned by this super_admin
    const { data: ownedZones } = await adminClient
      .from("zones")
      .select("id")
      .eq("created_by", profile.id);
    const zoneIds = (ownedZones || []).map((z: any) => z.id);
    if (zoneIds.length === 0) return [];
    query = query.in("zone_id", zoneIds);
  }
  // fondateur: no filter — sees all

  const { data } = await query;
  return (data || []) as any[];
}

export async function getMatchUnsoldMap(matchIds: string[]): Promise<Record<string, any>> {
  if (!matchIds.length) return {};
  const adminClient = await createAdminClient();
  const { data } = await adminClient
    .from("match_unsold")
    .select("*")
    .in("match_id", matchIds);
  return Object.fromEntries((data || []).map((d: any) => [d.match_id, d]));
}

export async function getMatchTicketStats(matchId: string): Promise<{ total: number; count: number; annuleCount: number }> {
  const adminClient = await createAdminClient();
  const [sold, annule] = await Promise.all([
    adminClient
      .from("tickets")
      .select("price")
      .eq("match_id", matchId)
      .neq("status", "annule"),
    adminClient
      .from("tickets")
      .select("id")
      .eq("match_id", matchId)
      .eq("status", "annule"),
  ]);
  const count = sold.data?.length || 0;
  const total = (sold.data || []).reduce((sum: number, t: any) => sum + t.price, 0);
  const annuleCount = annule.data?.length || 0;
  return { total, count, annuleCount };
}

export async function declareToutVendus(matchId: string): Promise<{ error?: string }> {
  await requireRole(["super_admin", "admin_zone", "fondateur"]);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const adminClient = await createAdminClient();
  const { error } = await adminClient.from("match_unsold").upsert(
    {
      match_id: matchId,
      unsold_count: 0,
      tout_vendus: true,
      declared_by: user.id,
      declared_at: new Date().toISOString(),
    },
    { onConflict: "match_id" }
  );

  if (error) return { error: error.message };
  revalidatePath("/invendus");
  revalidatePath("/finances");
  return {};
}

export async function closeMatchUnsold(matchId: string): Promise<{ error?: string }> {
  await requireRole(["super_admin", "admin_zone", "fondateur"]);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const adminClient = await createAdminClient();
  // Upsert with is_closed=true (creates the row if it doesn't exist)
  const { error } = await adminClient.from("match_unsold").upsert(
    {
      match_id: matchId,
      unsold_count: 0,
      tout_vendus: false,
      is_closed: true,
      declared_by: user.id,
      declared_at: new Date().toISOString(),
    },
    { onConflict: "match_id" }
  );
  // If row already exists, just update is_closed
  if (error) {
    const { error: updateErr } = await adminClient
      .from("match_unsold")
      .update({ is_closed: true })
      .eq("match_id", matchId);
    if (updateErr) return { error: updateErr.message };
  }
  revalidatePath("/invendus");
  return {};
}

export async function resetUnsold(matchId: string): Promise<{ error?: string }> {
  await requireRole(["super_admin", "admin_zone", "fondateur"]);
  const adminClient = await createAdminClient();
  const { error } = await adminClient
    .from("match_unsold")
    .delete()
    .eq("match_id", matchId);
  if (error) return { error: error.message };
  revalidatePath("/invendus");
  revalidatePath("/finances");
  return {};
}

// Scan unsold ticket: marks it as 'annule' in the DB
export async function scanUnsoldTicket(qrToken: string): Promise<{ status: "ok" | "already_annule" | "already_scanned" | "not_found"; message: string; matchName?: string }> {
  await requireRole(["super_admin", "admin_zone", "fondateur"]);
  const adminClient = await createAdminClient();

  const { data: ticket } = await adminClient
    .from("tickets")
    .select("id, status, match_id, match:matches!tickets_match_id_fkey(home_team, away_team)")
    .eq("qr_token", qrToken)
    .maybeSingle();

  if (!ticket) return { status: "not_found", message: "Billet inconnu dans le système." };

  const matchName = `${(ticket as any).match?.home_team} vs ${(ticket as any).match?.away_team}`;

  if (ticket.status === "annule") {
    return { status: "already_annule", message: "Billet déjà annulé (invendu).", matchName };
  }
  if (ticket.status === "scanne") {
    return { status: "already_scanned", message: "Billet déjà utilisé à l'entrée — ne peut pas être annulé.", matchName };
  }

  const { error } = await adminClient
    .from("tickets")
    .update({ status: "annule" })
    .eq("id", ticket.id);

  if (error) return { status: "not_found", message: "Erreur: " + error.message };

  revalidatePath("/invendus");
  revalidatePath("/finances");
  return { status: "ok", message: "Billet annulé (invendu).", matchName };
}

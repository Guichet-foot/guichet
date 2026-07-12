"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// Lecture seule pour president_odcav / tresorier : matchs terminés d'une zone spécifique
export async function getFinishedMatchesForZone(zoneId: string): Promise<any[]> {
  await requireRole(["super_admin", "president_odcav", "tresorier"]);
  const adminClient = await createAdminClient();
  const { data } = await adminClient
    .from("matches")
    .select("id, home_team, away_team, match_date, venue, zone_id, zone:zones!matches_zone_id_fkey(name)")
    .eq("status", "termine")
    .eq("zone_id", zoneId)
    .order("match_date", { ascending: false });
  return (data || []) as any[];
}

export async function getFinishedMatches() {
  const profile = await requireRole(["super_admin", "admin_zone", "fondateur", "c3"]);
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
  } else if (profile.role === "c3") {
    // C3: only their own matches
    query = query.eq("c3_account_id", profile.id);
  } else if (profile.role === "super_admin" || profile.role === "president_odcav" || profile.role === "tresorier") {
    const ownerId = (profile.role === "tresorier" && (profile as any).created_by_admin)
      ? (profile as any).created_by_admin as string : profile.id;
    const { data: subAdmins } = await adminClient
      .from("profiles").select("id").eq("created_by_admin", ownerId);
    const creatorIds = [ownerId, ...((subAdmins || []) as any[]).map((p: any) => p.id as string)];
    query = query.in("created_by", creatorIds).not("zone_id", "is", null);
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
  await requireRole(["super_admin", "admin_zone", "fondateur", "c3"]);
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
  await requireRole(["super_admin", "admin_zone", "fondateur", "c3"]);
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
  await requireRole(["super_admin", "admin_zone", "fondateur", "c3"]);
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

// ── Nouvelle API invendus sans scan billet par billet ─────────────────────

// Catégories d'un match avec comptes par statut de billet
export async function getMatchCategoriesForUnsold(matchId: string): Promise<{
  id: string; name: string; price: number;
  vendu_count: number; scanne_count: number; annule_count: number;
}[]> {
  await requireRole(["super_admin", "admin_zone", "fondateur", "c3"]);
  const adminClient = await createAdminClient();

  const { data: cats } = await adminClient
    .from("ticket_categories")
    .select("id, name, price")
    .eq("match_id", matchId)
    .eq("active", true)
    .order("display_order");

  if (!cats || cats.length === 0) return [];

  const catIds = cats.map((c: any) => c.id);
  const { data: tickets } = await adminClient
    .from("tickets")
    .select("category_id, status")
    .in("category_id", catIds);

  const venduMap: Record<string, number> = {};
  const scanneMap: Record<string, number> = {};
  const annuleMap: Record<string, number> = {};

  tickets?.forEach((t: any) => {
    if (t.status === "vendu") venduMap[t.category_id] = (venduMap[t.category_id] || 0) + 1;
    else if (t.status === "scanne") scanneMap[t.category_id] = (scanneMap[t.category_id] || 0) + 1;
    else if (t.status === "annule") annuleMap[t.category_id] = (annuleMap[t.category_id] || 0) + 1;
  });

  return cats.map((c: any) => ({
    id: c.id as string,
    name: c.name as string,
    price: c.price as number,
    vendu_count: venduMap[c.id] || 0,
    scanne_count: scanneMap[c.id] || 0,
    annule_count: annuleMap[c.id] || 0,
  }));
}

// Déclare les invendus par catégorie en entrant des nombres
// Réinitialise les billets annulés existants puis réapplique les nouveaux comptes
export async function declareUnsoldByCategory(
  matchId: string,
  categoryUnsolds: { categoryId: string; count: number }[]
): Promise<{ error?: string; totalUnsold?: number }> {
  await requireRole(["super_admin", "admin_zone", "fondateur", "c3"]);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const adminClient = await createAdminClient();

  // Étape 1 : remettre tous les billets annulés de ce match en "vendu"
  const { data: currentAnnule } = await adminClient
    .from("tickets")
    .select("id")
    .eq("match_id", matchId)
    .eq("status", "annule");

  if (currentAnnule && currentAnnule.length > 0) {
    await adminClient
      .from("tickets")
      .update({ status: "vendu" })
      .in("id", currentAnnule.map((t: any) => t.id));
  }

  // Étape 2 : annuler le nombre déclaré par catégorie
  let totalUnsold = 0;
  for (const { categoryId, count } of categoryUnsolds) {
    if (count <= 0) continue;
    const { data: vendus } = await adminClient
      .from("tickets")
      .select("id")
      .eq("match_id", matchId)
      .eq("category_id", categoryId)
      .eq("status", "vendu")
      .limit(count);

    if (!vendus || vendus.length === 0) continue;
    await adminClient
      .from("tickets")
      .update({ status: "annule" })
      .in("id", vendus.map((t: any) => t.id));
    totalUnsold += vendus.length;
  }

  // Étape 3 : mettre à jour match_unsold
  const { error: upsertErr } = await adminClient.from("match_unsold").upsert(
    {
      match_id: matchId,
      unsold_count: totalUnsold,
      tout_vendus: totalUnsold === 0,
      is_closed: false,
      declared_by: user.id,
      declared_at: new Date().toISOString(),
    },
    { onConflict: "match_id" }
  );
  if (upsertErr) return { error: upsertErr.message };

  revalidatePath("/invendus");
  revalidatePath("/finances");
  return { totalUnsold };
}

// Matchs disponibles pour la réattribution (même zone/C3, non terminés/annulés)
export async function getMatchesForReassignment(excludeMatchId: string): Promise<{
  id: string; home_team: string; away_team: string; match_date: string;
}[]> {
  const profile = await requireRole(["super_admin", "admin_zone", "fondateur", "c3"]);
  const adminClient = await createAdminClient();

  let query = adminClient
    .from("matches")
    .select("id, home_team, away_team, match_date")
    .neq("id", excludeMatchId)
    .not("status", "in", '("annule","termine")')
    .order("match_date", { ascending: true });

  if (profile.role === "admin_zone") {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data: prof } = await supabase.from("profiles").select("zone_id").eq("id", user.id).single();
    if (prof?.zone_id) query = query.eq("zone_id", prof.zone_id as string);
    else return [];
  } else if (profile.role === "c3") {
    query = query.eq("c3_account_id", profile.id);
  } else if (profile.role === "super_admin" || profile.role === "president_odcav" || profile.role === "tresorier") {
    const ownerId = (profile.role === "tresorier" && (profile as any).created_by_admin)
      ? (profile as any).created_by_admin as string : profile.id;
    const { data: subAdmins } = await adminClient.from("profiles").select("id").eq("created_by_admin", ownerId);
    const creatorIds = [ownerId, ...((subAdmins || []) as any[]).map((p: any) => p.id as string)];
    query = query.in("created_by", creatorIds).not("zone_id", "is", null);
  }

  const { data } = await query;
  return (data || []) as any[];
}

// Réattribue les billets non scannés d'un match vers un autre avec de nouveaux QR codes
export async function reassignTicketsToMatch(
  fromMatchId: string,
  toMatchId: string
): Promise<{ error?: string; count?: number }> {
  await requireRole(["super_admin", "admin_zone", "fondateur", "c3"]);
  const adminClient = await createAdminClient();

  // Récupère les billets non scannés (vendu + annule, pas scanne)
  const { data: tickets } = await adminClient
    .from("tickets")
    .select("id")
    .eq("match_id", fromMatchId)
    .neq("status", "scanne");

  if (!tickets || tickets.length === 0) {
    return { error: "Aucun billet non scanné trouvé pour ce match" };
  }

  // On transfère les données vers match B sans changer le QR code :
  // les billets physiques restent valides à la caisse du match B.
  // Les billets "annule" (invendus déclarés) redeviennent "vendu" dans match B.
  const ids = (tickets as any[]).map((t) => t.id);

  for (let i = 0; i < ids.length; i += 500) {
    const batch = ids.slice(i, i + 500);
    const { error } = await adminClient
      .from("tickets")
      .update({ match_id: toMatchId, status: "vendu" })
      .in("id", batch);
    if (error) return { error: error.message };
  }

  revalidatePath("/invendus");
  revalidatePath("/matchs");
  revalidatePath(`/matchs/${fromMatchId}`);
  revalidatePath(`/matchs/${toMatchId}`);
  return { count: ids.length };
}

// Matchs communaux/départementaux terminés — pour les onglets invendus ODCAV
export async function getFinishedInterMatches(matchType: "Match Communal" | "Match Départemental"): Promise<any[]> {
  const profile = await requireRole(["super_admin", "president_odcav", "tresorier"]);
  const adminClient = await createAdminClient();
  // Use profile.id as root identity; tresorier inherits from their parent
  const ownerId = (profile.role === "tresorier" && profile.created_by_admin)
    ? profile.created_by_admin as string : profile.id;

  const { data: subAdmins } = await adminClient.from("profiles").select("id").eq("created_by_admin", ownerId);
  const creatorIds = [ownerId, ...((subAdmins || []) as any[]).map((p: any) => p.id as string)];

  const { data } = await adminClient
    .from("matches")
    .select("id, home_team, away_team, home_team_zone, away_team_zone, match_date, venue, match_type")
    .eq("status", "termine")
    .eq("match_type", matchType)
    .eq("is_direct", true)
    .in("created_by", creatorIds)
    .order("match_date", { ascending: false });

  // Adapt to InvendusList shape (zone = null for inter-matches)
  return (data || []).map((m: any) => ({
    ...m,
    zone: null,
  })) as any[];
}

// Matchs communaux/départementaux non terminés — pour la réattribution
export async function getInterMatchesForReassignment(
  excludeMatchId: string,
  matchType: "Match Communal" | "Match Départemental"
): Promise<{ id: string; home_team: string; away_team: string; match_date: string }[]> {
  const profile = await requireRole(["super_admin", "president_odcav", "tresorier"]);
  const adminClient = await createAdminClient();
  const ownerId = (profile.role === "tresorier" && profile.created_by_admin)
    ? profile.created_by_admin as string : profile.id;

  const { data: subAdmins } = await adminClient.from("profiles").select("id").eq("created_by_admin", ownerId);
  const creatorIds = [ownerId, ...((subAdmins || []) as any[]).map((p: any) => p.id as string)];

  const { data } = await adminClient
    .from("matches")
    .select("id, home_team, away_team, match_date")
    .neq("id", excludeMatchId)
    .not("status", "in", '("annule","termine")')
    .eq("match_type", matchType)
    .eq("is_direct", true)
    .in("created_by", creatorIds)
    .order("match_date", { ascending: true });

  return (data || []) as any[];
}

// Scan unsold ticket: marks it as 'annule' in the DB
export async function scanUnsoldTicket(qrToken: string): Promise<{ status: "ok" | "already_annule" | "already_scanned" | "not_found"; message: string; matchName?: string }> {
  await requireRole(["super_admin", "admin_zone", "fondateur", "c3"]);
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

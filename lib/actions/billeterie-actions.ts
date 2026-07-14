"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { fetchAll } from "@/lib/supabase/paginate";
import { revalidatePath } from "next/cache";
import { format } from "date-fns";
import type { ScanResult } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface MatchOption {
  id: string;
  home_team: string;
  away_team: string;
  venue: string;
  match_date: string;
  match_type: string | null;
  status: string;
  home_team_zone: string | null;
  away_team_zone: string | null;
}

export interface BilleterieItem {
  id: string;
  name: string;
  matchIds: string[];
  price: number;
  createdAt: string;
  totalTickets: number;
}

// ── Matches disponibles pour créer un billetterie ─────────────────────────────
export async function getAllMatchesForBilleterie(): Promise<MatchOption[]> {
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

  const fields = "id, home_team, away_team, venue, match_date, match_type, status, home_team_zone, away_team_zone";

  // Fondateur, super_admin, president_odcav, tresorier → voient tous les matchs programmés
  if (
    profile.role === "fondateur" ||
    profile.role === "super_admin" ||
    profile.role === "president_odcav" ||
    profile.role === "tresorier"
  ) {
    const { data } = await adminClient
      .from("matches")
      .select(fields)
      .eq("status", "programme")
      .order("match_date", { ascending: false });
    return (data || []) as MatchOption[];
  }

  // Admin zone → uniquement les matchs de leur zone
  if (profile.role === "admin_zone") {
    const { data: prof } = await supabase.from("profiles").select("zone_id").eq("id", user.id).single();
    if (!prof?.zone_id) return [];
    const { data } = await adminClient.from("matches").select(fields).eq("zone_id", prof.zone_id as string).eq("status", "programme").order("match_date", { ascending: false });
    return (data || []) as MatchOption[];
  }

  // C3 → uniquement leurs matchs
  if (profile.role === "c3") {
    const { data } = await adminClient.from("matches").select(fields).eq("c3_account_id", user.id).eq("status", "programme").order("match_date", { ascending: false });
    return (data || []) as MatchOption[];
  }

  return [];
}

// ── Créer un billetterie + générer les billets ─────────────────────────────────
export async function createBilleterie(formData: {
  name: string;
  matchIds: string[];
  price: number;
  quantity?: number;
}): Promise<{ error?: string; billeterieId?: string; batchId?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const adminClient = await createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const allowed = ["super_admin", "president_odcav", "tresorier", "fondateur"];
  if (!profile || !allowed.includes(profile.role)) return { error: "Non autorisé" };

  if (!formData.name.trim()) return { error: "Nom obligatoire" };
  if (formData.matchIds.length < 1) return { error: "Sélectionnez au moins un match" };
  if (formData.price < 0) return { error: "Prix invalide" };

  const { data: bil, error: bilErr } = await adminClient
    .from("billeterie")
    .insert({ name: formData.name.trim(), match_ids: formData.matchIds, price: formData.price, created_by: user.id })
    .select("id")
    .single();

  if (bilErr || !bil) return { error: bilErr?.message || "Erreur création" };

  const qty = formData.quantity ?? 0;
  let batchId: string | undefined;

  if (qty > 0) {
    const today = format(new Date(), "yyyyMMdd");
    const { count: existingCount } = await adminClient
      .from("billeterie_tickets")
      .select("*", { count: "exact", head: true })
      .like("serial_number", `BIL-${today}-%`);

    batchId = crypto.randomUUID();
    const baseCount = existingCount || 0;

    const tickets = Array.from({ length: qty }, (_, i) => ({
      billeterie_id: bil.id,
      qr_token: crypto.randomUUID(),
      serial_number: `BIL-${today}-${String(baseCount + i + 1).padStart(5, "0")}`,
      sale_batch_id: batchId,
      sold_by: user.id,
      status: "actif",
    }));

    for (let i = 0; i < tickets.length; i += 100) {
      const { error: tickErr } = await adminClient.from("billeterie_tickets").insert(tickets.slice(i, i + 100));
      if (tickErr) return { error: tickErr.message };
    }
  }

  revalidatePath("/billeterie");
  return { billeterieId: bil.id, batchId };
}

// ── Ajouter des billets à un billetterie existant ─────────────────────────────
export async function addTicketsToBilleterie(
  billeterieId: string,
  quantity: number
): Promise<{ error?: string; batchId?: string; count?: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  if (quantity < 1 || quantity > 10000) return { error: "Quantité invalide (1–10 000)" };

  const adminClient = await createAdminClient();
  const { data: bil } = await adminClient.from("billeterie").select("id").eq("id", billeterieId).single();
  if (!bil) return { error: "Billetterie introuvable" };

  const today = format(new Date(), "yyyyMMdd");
  const { count: existingCount } = await adminClient
    .from("billeterie_tickets")
    .select("*", { count: "exact", head: true })
    .like("serial_number", `BIL-${today}-%`);

  const batchId = crypto.randomUUID();
  const baseCount = existingCount || 0;

  const tickets = Array.from({ length: quantity }, (_, i) => ({
    billeterie_id: billeterieId,
    qr_token: crypto.randomUUID(),
    serial_number: `BIL-${today}-${String(baseCount + i + 1).padStart(5, "0")}`,
    sale_batch_id: batchId,
    sold_by: user.id,
    status: "actif",
  }));

  for (let i = 0; i < tickets.length; i += 100) {
    const { error } = await adminClient.from("billeterie_tickets").insert(tickets.slice(i, i + 100));
    if (error) return { error: error.message };
  }

  revalidatePath(`/billeterie/${billeterieId}`);
  return { batchId, count: tickets.length };
}

// ── Liste des billetteries (pour la page /billeterie) ─────────────────────────
export async function getBilleterieList(): Promise<BilleterieItem[]> {
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

  const ownerId = (profile.created_by_admin ?? user.id) as string;

  let creatorIds: string[];
  if (profile.role === "fondateur") {
    creatorIds = [];
  } else {
    const { data: subAdmins } = await adminClient
      .from("profiles")
      .select("id")
      .eq("created_by_admin", ownerId);
    creatorIds = [ownerId, ...(subAdmins || []).map((p: any) => p.id as string)];
  }

  let query = adminClient.from("billeterie").select("id, name, match_ids, price, created_at");
  if (profile.role !== "fondateur") {
    query = query.in("created_by", creatorIds);
  }
  const { data } = await query.order("created_at", { ascending: false });
  if (!data || data.length === 0) return [];

  // Count tickets per billeterie (paginated — avoids server max_rows cap)
  const billIds = data.map((b: any) => b.id as string);
  const ticketRows = await fetchAll<any>((from, to) =>
    adminClient.from("billeterie_tickets").select("billeterie_id").in("billeterie_id", billIds).eq("withdrawn", false).range(from, to)
  );

  const ticketMap: Record<string, number> = {};
  ticketRows.forEach((t: any) => {
    ticketMap[t.billeterie_id] = (ticketMap[t.billeterie_id] || 0) + 1;
  });

  return data.map((b: any) => ({
    id: b.id as string,
    name: b.name as string,
    matchIds: (b.match_ids || []) as string[],
    price: b.price as number,
    createdAt: b.created_at as string,
    totalTickets: ticketMap[b.id] || 0,
  }));
}

// ── Détails d'un billetterie ──────────────────────────────────────────────────
export async function getBilleterieDetails(id: string): Promise<{
  id: string;
  name: string;
  matchIds: string[];
  price: number;
  createdAt: string;
  matches: MatchOption[];
  batches: { batchId: string; createdAt: string; count: number; withdrawnCount: number }[];
  totalTickets: number;
  totalScans: number;
} | null> {
  const adminClient = await createAdminClient();

  const { data: bil } = await adminClient
    .from("billeterie")
    .select("id, name, match_ids, price, created_at")
    .eq("id", id)
    .single();

  if (!bil) return null;

  const matchIds: string[] = bil.match_ids || [];

  const [{ data: matches }, allTicketRows] = await Promise.all([
    matchIds.length > 0
      ? adminClient.from("matches").select("id, home_team, away_team, venue, match_date, match_type, status, home_team_zone, away_team_zone").in("id", matchIds)
      : Promise.resolve({ data: [] as any[] }),
    fetchAll<any>((from, to) =>
      adminClient.from("billeterie_tickets").select("id, sale_batch_id, created_at, withdrawn").eq("billeterie_id", id).order("created_at").range(from, to)
    ),
  ]);

  // Batch grouping with withdrawn count
  const batchMap: Record<string, { batchId: string; createdAt: string; count: number; withdrawnCount: number }> = {};
  allTicketRows.forEach((t: any) => {
    if (!t.sale_batch_id) return;
    if (!batchMap[t.sale_batch_id]) {
      batchMap[t.sale_batch_id] = { batchId: t.sale_batch_id, createdAt: t.created_at, count: 0, withdrawnCount: 0 };
    }
    batchMap[t.sale_batch_id].count++;
    if (t.withdrawn) batchMap[t.sale_batch_id].withdrawnCount++;
  });
  const batches = Object.values(batchMap).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Scan count by match_id (avoids huge .in(ticket_id,[...3000 ids]) query that breaks PostgREST URL limits)
  const { count: scanCount } = matchIds.length > 0
    ? await adminClient.from("billeterie_scans").select("*", { count: "exact", head: true }).in("match_id", matchIds)
    : { count: 0 };

  return {
    id: bil.id,
    name: bil.name,
    matchIds,
    price: bil.price,
    createdAt: bil.created_at,
    matches: ((matches || []) as MatchOption[]).sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime()),
    batches,
    totalTickets: allTicketRows.filter((t: any) => !t.withdrawn).length,
    totalScans: scanCount || 0,
  };
}

// ── Invendus billetterie — liste avec comptage des non-scannés ────────────────
export interface BilleterieInvendusItem {
  id: string;
  name: string;
  matchIds: string[];
  price: number;
  createdAt: string;
  totalTickets: number;
  totalScanned: number;
  unscannedCount: number;
  matches: { id: string; home_team: string; away_team: string; match_date: string; status: string; match_type: string | null }[];
}

export async function getBilleterieInvendusList(): Promise<BilleterieInvendusItem[]> {
  const profile = await requireRole(["fondateur", "super_admin", "president_odcav", "tresorier", "admin_zone", "c3"]);
  const supabase = await createClient();
  const adminClient = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Fondateur, super_admin, president_odcav, tresorier → voient TOUT sans filtre.
  // Admin zone → uniquement les billeteries contenant des matchs de leur zone.
  // C3 → uniquement les billeteries contenant des matchs C3 qui les concernent.
  let matchIdFilter: string[] | null = null;

  if (profile.role === "admin_zone") {
    const { data: prof } = await supabase.from("profiles").select("zone_id").eq("id", user.id).single();
    if (!prof?.zone_id) return [];
    const { data: zoneMatches } = await adminClient.from("matches").select("id").eq("zone_id", prof.zone_id as string);
    matchIdFilter = (zoneMatches || []).map((m: any) => m.id as string);
    if (matchIdFilter.length === 0) return [];
  } else if (profile.role === "c3") {
    const { data: c3Matches } = await adminClient.from("matches").select("id").eq("c3_account_id", user.id);
    matchIdFilter = (c3Matches || []).map((m: any) => m.id as string);
    if (matchIdFilter.length === 0) return [];
  }

  let query = adminClient
    .from("billeterie")
    .select("id, name, match_ids, price, created_at")
    .order("created_at", { ascending: false });

  if (matchIdFilter !== null) {
    query = query.overlaps("match_ids", matchIdFilter);
  }

  const { data: bilList } = await query;

  if (!bilList || bilList.length === 0) return [];

  const bilIds = bilList.map((b: any) => b.id as string);

  // Tous les tickets avec leur statut de retrait
  const ticketRows = await fetchAll<any>((from, to) =>
    adminClient.from("billeterie_tickets")
      .select("id, billeterie_id, withdrawn")
      .in("billeterie_id", bilIds)
      .range(from, to)
  );

  type TicketRow = { id: string; withdrawn: boolean };
  const ticketsByBil: Record<string, TicketRow[]> = {};
  ticketRows.forEach((t: any) => {
    if (!ticketsByBil[t.billeterie_id]) ticketsByBil[t.billeterie_id] = [];
    ticketsByBil[t.billeterie_id].push({ id: t.id as string, withdrawn: Boolean(t.withdrawn) });
  });

  // Scans depuis billeterie_scans — requête par lots de 500 pour éviter
  // la limite URL de PostgREST avec les grands tableaux .in()
  const allTicketIds = ticketRows.map((t: any) => t.id as string);
  const scannedIds = new Set<string>();
  const BATCH = 500;
  for (let i = 0; i < allTicketIds.length; i += BATCH) {
    const batch = allTicketIds.slice(i, i + BATCH);
    const scanRows = await fetchAll<any>((from, to) =>
      adminClient.from("billeterie_scans")
        .select("ticket_id")
        .in("ticket_id", batch)
        .range(from, to)
    );
    scanRows.forEach((s: any) => scannedIds.add(s.ticket_id as string));
  }

  // Match info pour affichage
  const allMatchIds = [...new Set(bilList.flatMap((b: any) => (b.match_ids || []) as string[]))];
  const { data: matchData } = allMatchIds.length > 0
    ? await adminClient.from("matches")
        .select("id, home_team, away_team, match_date, status, match_type")
        .in("id", allMatchIds)
    : { data: [] as any[] };
  const matchMap = new Map((matchData || []).map((m: any) => [m.id as string, m]));

  return bilList.map((b: any) => {
    const tickets = ticketsByBil[b.id] || [];
    const totalTickets = tickets.length;
    // Scannés = billets validés à l'entrée (enregistrés dans billeterie_scans)
    const totalScanned = tickets.filter((t) => scannedIds.has(t.id)).length;
    // Invendus = billets non retirés du stock ET non scannés (encore chez l'organisateur)
    const unscannedCount = tickets.filter((t) => !t.withdrawn && !scannedIds.has(t.id)).length;
    const matchIds = (b.match_ids || []) as string[];
    return {
      id: b.id as string,
      name: b.name as string,
      matchIds,
      price: b.price as number,
      createdAt: b.created_at as string,
      totalTickets,
      totalScanned,
      unscannedCount,
      matches: matchIds
        .map((id: string) => matchMap.get(id))
        .filter(Boolean)
        .sort((a: any, b: any) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime()) as any[],
    };
  });
}

// ── Ajouter des matchs à une billetterie (redistribution invendus) ─────────────
export async function addMatchesToBilleterie(
  billeterieId: string,
  newMatchIds: string[]
): Promise<{ error?: string }> {
  await requireRole(["fondateur", "super_admin", "president_odcav", "tresorier"]);
  const adminClient = await createAdminClient();

  const { data: bil } = await adminClient
    .from("billeterie")
    .select("match_ids")
    .eq("id", billeterieId)
    .single();

  if (!bil) return { error: "Billetterie introuvable" };

  const merged = [...new Set([...(bil.match_ids || []), ...newMatchIds])];

  const { error } = await adminClient
    .from("billeterie")
    .update({ match_ids: merged })
    .eq("id", billeterieId);

  if (error) return { error: error.message };

  revalidatePath("/invendus");
  revalidatePath("/fondateur/invendus");
  revalidatePath(`/billeterie/${billeterieId}`);
  revalidatePath(`/fondateur/billeterie/${billeterieId}`);
  return {};
}

// ── Modifier un pass billetterie ───────────────────────────────────────────────
export async function updateBilleterie(
  id: string,
  formData: { name: string; price: number }
): Promise<{ error?: string }> {
  await requireRole(["fondateur", "super_admin", "president_odcav", "tresorier"]);
  const adminClient = await createAdminClient();

  const { error } = await adminClient
    .from("billeterie")
    .update({ name: formData.name.trim(), price: formData.price })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/billeterie");
  revalidatePath("/fondateur/billeterie");
  revalidatePath(`/billeterie/${id}`);
  revalidatePath(`/fondateur/billeterie/${id}`);
  return {};
}

// ── Supprimer un pass billetterie ──────────────────────────────────────────────
export async function deleteBilleterie(id: string): Promise<{ error?: string }> {
  await requireRole(["fondateur", "super_admin", "president_odcav", "tresorier"]);
  const adminClient = await createAdminClient();

  const { data: tickets } = await adminClient
    .from("billeterie_tickets")
    .select("id")
    .eq("billeterie_id", id);

  const ticketIds = (tickets || []).map((t: any) => t.id as string);
  if (ticketIds.length > 0) {
    await adminClient.from("billeterie_scans").delete().in("ticket_id", ticketIds);
  }
  await adminClient.from("billeterie_tickets").delete().eq("billeterie_id", id);

  const { error } = await adminClient.from("billeterie").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/billeterie");
  revalidatePath("/fondateur/billeterie");
  revalidatePath("/invendus");
  revalidatePath("/fondateur/invendus");
  return {};
}

// ── Retrait de billets (fondateur uniquement) ─────────────────────────────────
export async function withdrawBilleterieTickets(
  billeterieId: string,
  count: number
): Promise<{ error?: string; count?: number }> {
  await requireRole(["fondateur"]);
  const adminClient = await createAdminClient();

  const { data: tickets } = await adminClient
    .from("billeterie_tickets")
    .select("id")
    .eq("billeterie_id", billeterieId)
    .eq("withdrawn", false)
    .limit(count);

  if (!tickets || tickets.length === 0) return { error: "Aucun billet disponible à retirer" };

  const ids = tickets.map((t: any) => t.id);
  const { error } = await adminClient
    .from("billeterie_tickets")
    .update({ withdrawn: true })
    .in("id", ids);

  if (error) return { error: error.message };
  revalidatePath("/fondateur/billeterie", "page");
  return { count: ids.length };
}

// ── Validation billet billetterie (scanner portier) ───────────────────────────
// QR code format : "BIL-{uuid}" — le préfixe distingue des billets ordinaires
export async function validateBilleterieTicket(rawToken: string): Promise<ScanResult> {
  const supabase = await createClient();
  const adminClient = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "invalid", message: "Non authentifié" };

  const qrToken = rawToken.startsWith("BIL-") ? rawToken.slice(4) : rawToken;

  const { data: ticket } = await adminClient
    .from("billeterie_tickets")
    .select("id, billeterie_id, status, billeterie:billeterie_id(name, match_ids)")
    .eq("qr_token", qrToken)
    .maybeSingle();

  if (!ticket) return { status: "invalid", message: "Billet invalide" };
  if (ticket.status === "annule") return { status: "invalid", message: "Billet annulé" };

  const bil = (ticket as any).billeterie;
  const matchIds: string[] = bil?.match_ids || [];
  if (matchIds.length === 0) return { status: "invalid", message: "Billetterie sans match" };

  // 1. Check if this ticket was already scanned for ANY match in this billeterie.
  //    One ticket = one entry total, regardless of how many matches are en_cours.
  const { data: anyExistingScan } = await adminClient
    .from("billeterie_scans")
    .select("scanned_at")
    .eq("ticket_id", ticket.id)
    .in("match_id", matchIds)
    .order("scanned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (anyExistingScan) {
    return {
      status: "already_scanned",
      message: "Déjà utilisé",
      scannedAt: anyExistingScan.scanned_at || undefined,
      categoryName: bil.name,
    };
  }

  // 2. No prior scan — find the current en_cours match and record entry.
  const { data: enCoursMatches } = await adminClient
    .from("matches")
    .select("id, home_team, away_team")
    .in("id", matchIds)
    .eq("status", "en_cours");

  if (!enCoursMatches || enCoursMatches.length === 0) {
    return { status: "invalid", message: "Aucun match en cours pour ce billet" };
  }

  const match = enCoursMatches[0];
  const { error } = await adminClient.from("billeterie_scans").insert({
    ticket_id: ticket.id,
    match_id: match.id,
    scanned_by: user.id,
    scanned_at: new Date().toISOString(),
  });
  if (error) return { status: "invalid", message: "Erreur lors du scan" };

  return {
    status: "valid",
    message: "Entrée validée",
    categoryName: `${bil.name} · ${match.home_team} vs ${match.away_team}`,
  };
}

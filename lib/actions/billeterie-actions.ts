"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
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

  if (profile.role === "fondateur") {
    const { data } = await adminClient
      .from("matches")
      .select(fields)
      .eq("status", "programme")
      .order("match_date", { ascending: false });
    return (data || []) as MatchOption[];
  }

  const ownerId = (profile.created_by_admin ?? user.id) as string;

  // Zones owned by this ODCAV
  const { data: zones } = await adminClient
    .from("zones")
    .select("id")
    .eq("created_by", ownerId);
  const zoneIds = (zones || []).map((z: any) => z.id as string);

  // Sub-admins of this ODCAV
  const { data: subAdmins } = await adminClient
    .from("profiles")
    .select("id")
    .eq("created_by_admin", ownerId);
  const creatorIds = [ownerId, ...(subAdmins || []).map((p: any) => p.id as string)];

  const [zoneRes, directRes] = await Promise.all([
    zoneIds.length > 0
      ? adminClient.from("matches").select(fields).in("zone_id", zoneIds).eq("status", "programme").order("match_date", { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
    adminClient.from("matches").select(fields).in("created_by", creatorIds).eq("status", "programme").order("match_date", { ascending: false }),
  ]);

  const all = [...(zoneRes.data || []), ...(directRes.data || [])];
  const seen = new Set<string>();
  return all
    .filter((m: any) => { if (seen.has(m.id)) return false; seen.add(m.id); return true; })
    .sort((a: any, b: any) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime()) as MatchOption[];
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

  // Count tickets per billeterie
  const billIds = data.map((b: any) => b.id as string);
  const { data: ticketRows } = await adminClient
    .from("billeterie_tickets")
    .select("billeterie_id")
    .in("billeterie_id", billIds);

  const ticketMap: Record<string, number> = {};
  (ticketRows || []).forEach((t: any) => {
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

  const [{ data: matches }, { data: ticketRows }] = await Promise.all([
    matchIds.length > 0
      ? adminClient.from("matches").select("id, home_team, away_team, venue, match_date, match_type, status, home_team_zone, away_team_zone").in("id", matchIds)
      : Promise.resolve({ data: [] as any[] }),
    adminClient.from("billeterie_tickets").select("id, sale_batch_id, created_at, withdrawn").eq("billeterie_id", id).order("created_at"),
  ]);

  // Batch grouping with withdrawn count
  const batchMap: Record<string, { batchId: string; createdAt: string; count: number; withdrawnCount: number }> = {};
  (ticketRows || []).forEach((t: any) => {
    if (!t.sale_batch_id) return;
    if (!batchMap[t.sale_batch_id]) {
      batchMap[t.sale_batch_id] = { batchId: t.sale_batch_id, createdAt: t.created_at, count: 0, withdrawnCount: 0 };
    }
    batchMap[t.sale_batch_id].count++;
    if (t.withdrawn) batchMap[t.sale_batch_id].withdrawnCount++;
  });
  const batches = Object.values(batchMap).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Scan count (only non-withdrawn tickets)
  const activeTicketIds = (ticketRows || []).filter((t: any) => !t.withdrawn).map((t: any) => t.id as string);
  const { count: scanCount } = activeTicketIds.length > 0
    ? await adminClient.from("billeterie_scans").select("*", { count: "exact", head: true }).in("ticket_id", activeTicketIds)
    : { count: 0 };

  return {
    id: bil.id,
    name: bil.name,
    matchIds,
    price: bil.price,
    createdAt: bil.created_at,
    matches: ((matches || []) as MatchOption[]).sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime()),
    batches,
    totalTickets: (ticketRows || []).filter((t: any) => !t.withdrawn).length,
    totalScans: scanCount || 0,
  };
}

// ── Retrait de billets d'un lot (fondateur uniquement) ────────────────────────
export async function withdrawBilleterieBatch(batchId: string): Promise<{ error?: string; count?: number }> {
  await requireRole(["fondateur"]);
  const adminClient = await createAdminClient();

  const { data: tickets } = await adminClient
    .from("billeterie_tickets")
    .select("id")
    .eq("sale_batch_id", batchId)
    .eq("withdrawn", false);

  if (!tickets || tickets.length === 0) return { error: "Tous les billets de ce lot sont déjà retirés" };

  const { error } = await adminClient
    .from("billeterie_tickets")
    .update({ withdrawn: true })
    .eq("sale_batch_id", batchId);

  if (error) return { error: error.message };
  revalidatePath("/fondateur/billeterie", "page");
  return { count: tickets.length };
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

  // Find matches en cours belonging to this billeterie
  const { data: enCoursMatches } = await adminClient
    .from("matches")
    .select("id, home_team, away_team")
    .in("id", matchIds)
    .eq("status", "en_cours");

  if (!enCoursMatches || enCoursMatches.length === 0) {
    return { status: "invalid", message: "Aucun match en cours pour ce billet" };
  }

  // Try to scan for each en_cours match (first unscanned wins)
  for (const match of enCoursMatches) {
    const { data: existingScan } = await adminClient
      .from("billeterie_scans")
      .select("id, scanned_at")
      .eq("ticket_id", ticket.id)
      .eq("match_id", match.id)
      .maybeSingle();

    if (!existingScan) {
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
  }

  // All en_cours matches already scanned
  const { data: lastScan } = await adminClient
    .from("billeterie_scans")
    .select("scanned_at")
    .eq("ticket_id", ticket.id)
    .order("scanned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    status: "already_scanned",
    message: "Déjà utilisé",
    scannedAt: lastScan?.scanned_at || undefined,
    categoryName: bil.name,
  };
}

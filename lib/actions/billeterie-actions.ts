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

  // Fondateur, super_admin, president_odcav, tresorier → voient tous les matchs programmés ou en cours
  if (
    profile.role === "fondateur" ||
    profile.role === "super_admin" ||
    profile.role === "president_odcav" ||
    profile.role === "tresorier"
  ) {
    const { data } = await adminClient
      .from("matches")
      .select(fields)
      .in("status", ["programme", "en_cours"])
      .order("match_date", { ascending: false });
    return (data || []) as MatchOption[];
  }

  // Admin zone → uniquement les matchs de leur zone
  if (profile.role === "admin_zone") {
    const { data: prof } = await supabase.from("profiles").select("zone_id").eq("id", user.id).single();
    if (!prof?.zone_id) return [];
    const { data } = await adminClient.from("matches").select(fields).eq("zone_id", prof.zone_id as string).in("status", ["programme", "en_cours"]).order("match_date", { ascending: false });
    return (data || []) as MatchOption[];
  }

  // C3 → uniquement leurs matchs
  if (profile.role === "c3") {
    const { data } = await adminClient.from("matches").select(fields).eq("c3_account_id", user.id).in("status", ["programme", "en_cours"]).order("match_date", { ascending: false });
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
  attributedBillets: number;
  attributedScans: number;
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

  // Scan count for OWN tickets only (filter in memory to avoid PostgREST URL limit on ticket_id)
  const ownTicketIdSet = new Set(allTicketRows.map((t: any) => t.id as string));
  let ownScanCount = 0;
  if (matchIds.length > 0 && ownTicketIdSet.size > 0) {
    const scansAtOwnMatches = await fetchAll<any>((from, to) =>
      adminClient.from("billeterie_scans")
        .select("ticket_id")
        .in("match_id", matchIds)
        .range(from, to)
    );
    ownScanCount = scansAtOwnMatches.filter((s: any) => ownTicketIdSet.has(s.ticket_id as string)).length;
  }

  // Invendus attribués depuis d'autres billeteries couvrant les mêmes matchs
  let attributedBillets = 0;
  let attributedScans = 0;
  if (matchIds.length > 0) {
    const { data: otherBils } = await adminClient
      .from("billeterie")
      .select("id, match_ids")
      .neq("id", id);

    const relatedBils = (otherBils || []).filter((b: any) =>
      (b.match_ids || []).some((mid: string) => matchIds.includes(mid))
    );

    if (relatedBils.length > 0) {
      const relatedBilIds = relatedBils.map((b: any) => b.id as string);
      const allRelatedMatchIds = [...new Set(
        relatedBils.flatMap((b: any) => (b.match_ids || []) as string[])
      )];
      const thisMatchSet = new Set(matchIds);

      const [relatedTickets, relatedScans] = await Promise.all([
        fetchAll<any>((from, to) =>
          adminClient.from("billeterie_tickets")
            .select("id, billeterie_id, withdrawn")
            .in("billeterie_id", relatedBilIds)
            .range(from, to)
        ),
        fetchAll<any>((from, to) =>
          adminClient.from("billeterie_scans")
            .select("ticket_id, match_id")
            .in("match_id", allRelatedMatchIds)
            .range(from, to)
        ),
      ]);

      const nonWithdrawnByBil: Record<string, number> = {};
      const ticketIdToBilId: Record<string, string> = {};
      relatedTickets.forEach((t: any) => {
        ticketIdToBilId[t.id] = t.billeterie_id;
        if (!t.withdrawn) {
          nonWithdrawnByBil[t.billeterie_id] = (nonWithdrawnByBil[t.billeterie_id] || 0) + 1;
        }
      });

      const totalScansByBil: Record<string, number> = {};
      const sharedScansByBil: Record<string, number> = {};
      relatedScans.forEach((s: any) => {
        const bilId = ticketIdToBilId[s.ticket_id];
        if (!bilId) return;
        totalScansByBil[bilId] = (totalScansByBil[bilId] || 0) + 1;
        if (thisMatchSet.has(s.match_id)) {
          sharedScansByBil[bilId] = (sharedScansByBil[bilId] || 0) + 1;
        }
      });

      relatedBilIds.forEach((bilId: string) => {
        const nw = nonWithdrawnByBil[bilId] || 0;
        const ts = totalScansByBil[bilId] || 0;
        const ss = sharedScansByBil[bilId] || 0;
        // Invendus disponibles pour nos matchs = non-retirés − scans aux autres matchs
        attributedBillets += Math.max(0, nw - (ts - ss));
        attributedScans += ss;
      });
    }
  }

  return {
    id: bil.id,
    name: bil.name,
    matchIds,
    price: bil.price,
    createdAt: bil.created_at,
    matches: ((matches || []) as MatchOption[]).sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime()),
    batches,
    totalTickets: allTicketRows.filter((t: any) => !t.withdrawn).length,
    totalScans: ownScanCount,
    attributedBillets,
    attributedScans,
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
  isAttributed: boolean; // true si les invendus ont déjà été attribués à une autre billetterie
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
    // Matchs avec c3_account_id + matchs des zones affiliées au C3
    const { data: c3Profile } = await adminClient
      .from("profiles").select("c3_zone_ids").eq("id", user.id).single();
    const c3ZoneIds: string[] = (c3Profile as any)?.c3_zone_ids || [];
    const queries: any[] = [
      adminClient.from("matches").select("id").eq("c3_account_id", user.id),
    ];
    if (c3ZoneIds.length > 0) {
      queries.push(adminClient.from("matches").select("id").in("zone_id", c3ZoneIds));
    }
    const results: any[] = await Promise.all(queries);
    matchIdFilter = [...new Set(
      results.flatMap((r) => (r.data || []).map((m: any) => m.id as string))
    )];
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
  const allMatchIds = [...new Set(bilList.flatMap((b: any) => (b.match_ids || []) as string[]))];

  // Tickets : id + billeterie_id + withdrawn (pour ticketToBilId et comptage invendus)
  const ticketRows = await fetchAll<any>((from, to) =>
    adminClient.from("billeterie_tickets")
      .select("id, billeterie_id, withdrawn")
      .in("billeterie_id", bilIds)
      .range(from, to)
  );
  const nonWithdrawnByBil: Record<string, number> = {};
  const ticketToBilId: Record<string, string> = {};
  ticketRows.forEach((t: any) => {
    ticketToBilId[t.id as string] = t.billeterie_id as string;
    if (!t.withdrawn) {
      nonWithdrawnByBil[t.billeterie_id] = (nonWithdrawnByBil[t.billeterie_id] || 0) + 1;
    }
  });

  // Scans : ticket_id + match_id pour fréquentation ET calcul attributedBillets
  const scansAtMatch: Record<string, number> = {};
  const totalScansByBil: Record<string, number> = {};
  const scansByBilAndMatch: Record<string, Record<string, number>> = {};

  if (allMatchIds.length > 0) {
    const scanRows = await fetchAll<any>((from, to) =>
      adminClient.from("billeterie_scans")
        .select("ticket_id, match_id")
        .in("match_id", allMatchIds)
        .range(from, to)
    );
    scanRows.forEach((s: any) => {
      scansAtMatch[s.match_id] = (scansAtMatch[s.match_id] || 0) + 1;
      const bilId = ticketToBilId[s.ticket_id as string];
      if (bilId) {
        totalScansByBil[bilId] = (totalScansByBil[bilId] || 0) + 1;
        if (!scansByBilAndMatch[bilId]) scansByBilAndMatch[bilId] = {};
        scansByBilAndMatch[bilId][s.match_id] = (scansByBilAndMatch[bilId][s.match_id] || 0) + 1;
      }
    });
  }

  // Set de matchIds par billeterie pour les calculs croisés
  const bilMatchSet: Record<string, Set<string>> = {};
  for (const b of bilList) bilMatchSet[b.id] = new Set((b.match_ids || []) as string[]);

  // Pour chaque billeterie B : fréquentation + billets attribués depuis billeteries partenaires
  const attendanceByBil: Record<string, number> = {};
  const attributedByBil: Record<string, number> = {};
  // Scans des tickets partenaires aux matchs partagés avec B (crédités à B pour l'affichage)
  const partnerScannedByBil: Record<string, number> = {};

  for (const B of bilList) {
    const Bset = bilMatchSet[B.id];

    // Fréquentation = total scans à ses matchs (toutes billeteries confondues)
    let attendance = 0;
    for (const mId of Bset) attendance += scansAtMatch[mId] || 0;
    attendanceByBil[B.id] = attendance;

    // Billets attribués depuis billeteries partageant au moins un match avec B
    let attributed = 0;
    let partnerScanned = 0;
    for (const X of bilList) {
      if (X.id === B.id) continue;
      const Xset = bilMatchSet[X.id];
      let hasOverlap = false;
      for (const mId of Xset) { if (Bset.has(mId)) { hasOverlap = true; break; } }
      if (!hasOverlap) continue;
      const nw_X = nonWithdrawnByBil[X.id] || 0;
      const ts_X = totalScansByBil[X.id] || 0;
      let ss_X = 0;
      const xByMatch = scansByBilAndMatch[X.id] || {};
      for (const mId of Bset) { if (Xset.has(mId)) ss_X += xByMatch[mId] || 0; }
      attributed += Math.max(0, nw_X - (ts_X - ss_X));
      partnerScanned += ss_X;
    }
    attributedByBil[B.id] = attributed;
    partnerScannedByBil[B.id] = partnerScanned;
  }

  // Détection des billeteries dont les invendus ont été attribués à une billeterie plus récente.
  // Heuristique : une billeterie X est "attribuée" si une billeterie créée APRÈS X partage ses matchs.
  // La plus récente est la billeterie principale (ex. Phases Dép.) ; l'ancienne est celle redistribuée.
  const isAttributedByBil: Record<string, boolean> = {};
  for (const X of bilList) {
    const Xset = bilMatchSet[X.id];
    const Xtime = new Date(X.created_at).getTime();
    for (const B of bilList) {
      if (B.id === X.id) continue;
      if (new Date(B.created_at).getTime() <= Xtime) continue; // B doit être plus récent que X
      const Bset = bilMatchSet[B.id];
      for (const mId of Bset) {
        if (Xset.has(mId)) { isAttributedByBil[X.id] = true; break; }
      }
      if (isAttributedByBil[X.id]) break;
    }
  }

  // Match info pour affichage
  const { data: matchData } = allMatchIds.length > 0
    ? await adminClient.from("matches")
        .select("id, home_team, away_team, match_date, status, match_type")
        .in("id", allMatchIds)
    : { data: [] as any[] };
  const matchMap = new Map((matchData || []).map((m: any) => [m.id as string, m]));

  return bilList.map((b: any) => {
    const matchIds = (b.match_ids || []) as string[];
    const isAttributed = isAttributedByBil[b.id] || false;
    const ownTickets = nonWithdrawnByBil[b.id] || 0;
    // Si la billeterie est attribuée, ses invendus sont "consommés" → on n'additionne pas les autres
    const attributed = isAttributed ? 0 : (attributedByBil[b.id] || 0);
    const totalTickets = ownTickets + attributed;
    // totalScanned = propres scans + scans des tickets partenaires aux matchs partagés
    // (les tickets attribués sont scannés sous leur billeterie d'origine mais comptent ici)
    const totalScanned = (totalScansByBil[b.id] || 0) + (partnerScannedByBil[b.id] || 0);
    // Si attribuée : 0 invendus restants (les tickets ont été affectés à une autre billetterie)
    const unscannedCount = isAttributed ? 0 : Math.max(0, totalTickets - totalScanned);
    return {
      id: b.id as string,
      name: b.name as string,
      matchIds,
      price: b.price as number,
      createdAt: b.created_at as string,
      totalTickets,
      totalScanned,
      unscannedCount,
      isAttributed,
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

  // Charger created_at de la billeterie pour suivre la chaîne d'attribution
  const { data: bilRow } = await adminClient
    .from("billeterie")
    .select("created_at")
    .eq("id", (ticket as any).billeterie_id)
    .single();

  // Suivre la chaîne d'attribution : les billeteries plus récentes qui partagent des matchs
  // avec celle-ci ont reçu les invendus → leurs matchs sont aussi valables pour ce billet.
  let allMatchIds: string[] = [...matchIds];
  if (bilRow?.created_at) {
    const { data: newerBilleteries } = await adminClient
      .from("billeterie")
      .select("match_ids")
      .gt("created_at", bilRow.created_at);

    for (const nb of (newerBilleteries || []) as any[]) {
      const nbIds: string[] = nb.match_ids || [];
      if (nbIds.some((m: string) => matchIds.includes(m))) {
        for (const m of nbIds) {
          if (!allMatchIds.includes(m)) allMatchIds.push(m);
        }
      }
    }
  }

  // 1. Vérifier si ce billet a déjà été scanné à N'IMPORTE QUEL match (chaîne complète).
  //    Un billet déjà utilisé reste bloqué définitivement.
  const { data: anyExistingScan } = await adminClient
    .from("billeterie_scans")
    .select("scanned_at")
    .eq("ticket_id", ticket.id)
    .in("match_id", allMatchIds)
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

  // 2. Trouver un match dans toute la chaîne : en_cours en priorité, sinon programme,
  //    sinon le plus récent même terminé (billet valable même après la fin du match).
  const { data: activeMatches } = await adminClient
    .from("matches")
    .select("id, home_team, away_team, status")
    .in("id", allMatchIds)
    .in("status", ["en_cours", "programme"])
    .order("match_date", { ascending: true });

  let match: any;
  if (activeMatches && activeMatches.length > 0) {
    match = (activeMatches as any[]).find((m: any) => m.status === "en_cours") || activeMatches[0];
  } else {
    // Tous les matchs sont terminés → on autorise quand même le scan sur le plus récent.
    // scanned_at = aujourd'hui → comptabilisé dans les stats du jour du scan.
    const { data: lastMatch } = await adminClient
      .from("matches")
      .select("id, home_team, away_team, status")
      .in("id", allMatchIds)
      .order("match_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!lastMatch) return { status: "invalid", message: "Aucun match trouvé pour ce billet" };
    match = lastMatch;
  }

  // 3. Enregistrer l'entrée.
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

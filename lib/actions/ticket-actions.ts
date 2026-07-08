"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { format } from "date-fns";

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function getMatchCategoriesForSale(matchId: string): Promise<{
  id: string;
  name: string;
  price: number;
  sold_count: number;
}[]> {
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
    .select("category_id")
    .in("category_id", catIds)
    .neq("status", "annule");

  const soldMap: Record<string, number> = {};
  tickets?.forEach((t: any) => {
    soldMap[t.category_id] = (soldMap[t.category_id] || 0) + 1;
  });

  return cats.map((c: any) => ({
    id: c.id as string,
    name: c.name as string,
    price: c.price as number,
    sold_count: soldMap[c.id] || 0,
  }));
}
import type { ScanResult } from "@/lib/types";

export async function createTicket(matchId: string, categoryId: string) {
  return createTickets(matchId, categoryId, 1);
}

export async function createTickets(matchId: string, categoryId: string, quantity: number) {
  const qty = Math.max(1, Math.min(30, quantity || 1));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Non authentifié" };

  const adminClient = await createAdminClient();

  const { data: category } = await adminClient
    .from("ticket_categories")
    .select("price, match_id")
    .eq("id", categoryId)
    .single();

  if (!category) return { error: "Catégorie introuvable" };

  const { data: match } = await adminClient
    .from("matches")
    .select("status")
    .eq("id", matchId)
    .single();

  if (!match) return { error: "Match introuvable" };
  if (match.status === "termine" || match.status === "annule") {
    return { error: "Ce match est terminé" };
  }

  const today = format(new Date(), "yyyyMMdd");

  const { count: todayCount } = await adminClient
    .from("tickets")
    .select("*", { count: "exact", head: true })
    .like("serial_number", `GF-${today}-%`);

  const batchId = crypto.randomUUID();
  const baseCount = todayCount || 0;

  const ticketsToInsert = Array.from({ length: qty }, (_, i) => ({
    match_id: matchId,
    category_id: categoryId,
    price: category.price,
    serial_number: `GF-${today}-${String(baseCount + i + 1).padStart(4, "0")}`,
    sold_by: user.id,
    status: "vendu",
    sale_batch_id: batchId,
  }));

  const { data: inserted, error } = await adminClient
    .from("tickets")
    .insert(ticketsToInsert)
    .select("id");

  if (error) return { error: error.message };

  revalidatePath("/vente");
  revalidatePath("/mes-ventes");
  return {
    batchId,
    ticketId: inserted[0]?.id,
    ticketIds: inserted.map((t) => t.id),
  };
}

// ── printTicketBloc ───────────────────────────────────────────────
// ODCAV / fondateur pre-print physical ticket blocks (100 tickets = 1 bloc).
// No vente_active check — ODCAV prints before the match starts.
// No quantity_total limit — ODCAV decides how many to print.
export async function printTicketBloc(matchId: string, categoryId: string, blocs: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();

  if (!profile || !["super_admin", "fondateur"].includes(profile.role)) {
    return { error: "Non autorisé — réservé à l'ODCAV et au fondateur" };
  }

  const qty = Math.max(1, blocs) * 100;
  const adminClient = await createAdminClient();

  const { data: category } = await adminClient
    .from("ticket_categories").select("price, name").eq("id", categoryId).single();
  if (!category) return { error: "Catégorie introuvable" };

  const { data: match } = await adminClient
    .from("matches").select("status").eq("id", matchId).single();
  if (!match) return { error: "Match introuvable" };
  if (match.status === "termine" || match.status === "annule") {
    return { error: "Ce match est terminé ou annulé" };
  }

  const today = format(new Date(), "yyyyMMdd");
  const { count: todayCount } = await adminClient
    .from("tickets").select("*", { count: "exact", head: true })
    .like("serial_number", `GF-${today}-%`);

  const batchId = crypto.randomUUID();
  const baseCount = todayCount || 0;
  const ticketsToInsert = Array.from({ length: qty }, (_, i) => ({
    match_id: matchId,
    category_id: categoryId,
    price: category.price,
    serial_number: `GF-${today}-${String(baseCount + i + 1).padStart(5, "0")}`,
    sold_by: user.id,
    status: "vendu",
    sale_batch_id: batchId,
    bloc_printed: true,
  }));

  // Insert in chunks of 100 to stay within request limits
  for (let i = 0; i < ticketsToInsert.length; i += 100) {
    const { error } = await adminClient.from("tickets").insert(ticketsToInsert.slice(i, i + 100));
    if (error) return { error: error.message };
  }

  revalidatePath("/matchs");
  return { batchId };
}

// ── sellBlocTickets ───────────────────────────────────────────────
// Caissier records a sale WITHOUT printing.
// Claims N pre-printed ODCAV bloc tickets (bloc_printed=true) by updating
// caissier_claimed_at + caissier_id + sold_by so they count as revenue.
// If fewer bloc tickets are available than requested, claims what's available
// and creates the remainder as new tickets (no print).
export async function sellBlocTickets(matchId: string, categoryId: string, quantity: number) {
  const qty = Math.max(1, Math.min(100, quantity || 1));

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const adminClient = await createAdminClient();

  const { data: match } = await adminClient
    .from("matches").select("status").eq("id", matchId).single();
  if (!match) return { error: "Match introuvable" };
  if (match.status === "termine" || match.status === "annule") {
    return { error: "Ce match est terminé" };
  }

  const { data: category } = await adminClient
    .from("ticket_categories").select("price").eq("id", categoryId).single();
  if (!category) return { error: "Catégorie introuvable" };

  // Find available bloc tickets (printed by ODCAV, not yet claimed by a caissier)
  const { data: availableBlocs } = await adminClient
    .from("tickets")
    .select("id")
    .eq("match_id", matchId)
    .eq("category_id", categoryId)
    .eq("bloc_printed", true)
    .is("caissier_claimed_at", null)
    .neq("status", "annule")
    .limit(qty);

  const now = new Date().toISOString();
  const today = format(new Date(), "yyyyMMdd");
  let soldCount = 0;

  // Claim however many bloc tickets are available
  if (availableBlocs && availableBlocs.length > 0) {
    const claimIds = availableBlocs.map((t) => t.id);
    const { error: claimErr } = await adminClient
      .from("tickets")
      .update({ caissier_claimed_at: now, caissier_id: user.id, sold_by: user.id, sold_at: now })
      .in("id", claimIds);
    if (claimErr) return { error: claimErr.message };
    soldCount += claimIds.length;
  }

  // If not enough bloc tickets, create the remainder as new (non-printed) tickets
  const remaining = qty - soldCount;
  if (remaining > 0) {
    const { count: todayCount } = await adminClient
      .from("tickets").select("*", { count: "exact", head: true })
      .like("serial_number", `GF-${today}-%`);

    const batchId = crypto.randomUUID();
    const baseCount = todayCount || 0;
    const newTickets = Array.from({ length: remaining }, (_, i) => ({
      match_id: matchId,
      category_id: categoryId,
      price: category.price,
      serial_number: `GF-${today}-${String(baseCount + i + 1).padStart(4, "0")}`,
      sold_by: user.id,
      sold_at: now,
      status: "vendu",
      sale_batch_id: batchId,
      bloc_printed: false,
      caissier_id: user.id,
      caissier_claimed_at: now,
    }));
    const { error: insertErr } = await adminClient.from("tickets").insert(newTickets);
    if (insertErr) return { error: insertErr.message };
    soldCount += remaining;
  }

  revalidatePath("/vente");
  revalidatePath("/mes-ventes");
  return { sold: soldCount };
}

export async function validateTicket(qrToken: string): Promise<ScanResult> {
  const supabase = await createClient();
  const adminClient = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { status: "invalid", message: "Non authentifié" };

  const { data: userProfile } = await supabase
    .from("profiles")
    .select("zone_id, created_by_admin")
    .eq("id", user.id)
    .single();

  const { data: ticket } = await adminClient
    .from("tickets")
    .select(
      "*, match:matches(zone_id, c3_account_id, home_team, away_team, status), category:ticket_categories(name)"
    )
    .eq("qr_token", qrToken)
    .single();

  if (!ticket) {
    return { status: "invalid", message: "Billet invalide" };
  }

  const matchZoneId = (ticket as any).match?.zone_id;
  const matchC3AccountId = (ticket as any).match?.c3_account_id;
  const portierZoneId = userProfile?.zone_id ?? null;
  const portierC3AccountId = userProfile?.created_by_admin ?? null;

  const isAuthorized =
    // Zone normale : même zone_id
    (portierZoneId !== null && portierZoneId === matchZoneId) ||
    // Compte C3 : pas de zone_id mais même c3_account_id
    (portierZoneId === null && portierC3AccountId !== null && portierC3AccountId === matchC3AccountId);

  if (!isAuthorized) {
    return { status: "invalid", message: "Billet d'une autre zone" };
  }

  // Vérifier le statut du billet avant le statut du match :
  // un billet déjà scanné doit retourner "already_scanned" même si le match
  // source n'est plus "en_cours" (ex: billets réattribués depuis un match A).
  if (ticket.status === "annule") {
    return { status: "invalid", message: "Billet annulé" };
  }

  if (ticket.status === "scanne") {
    return {
      status: "already_scanned",
      message: "Déjà scanné",
      scannedAt: ticket.scanned_at || undefined,
      categoryName: (ticket as any).category?.name,
    };
  }

  const matchStatus = (ticket as any).match?.status;
  if (matchStatus !== "en_cours") {
    return { status: "invalid", message: "Le match n'est pas encore démarré" };
  }

  const { error } = await adminClient
    .from("tickets")
    .update({
      status: "scanne",
      scanned_at: new Date().toISOString(),
      scanned_by: user.id,
    })
    .eq("id", ticket.id);

  if (error) {
    return { status: "invalid", message: "Erreur lors du scan" };
  }

  return {
    status: "valid",
    message: "Entrée validée",
    categoryName: (ticket as any).category?.name,
  };
}

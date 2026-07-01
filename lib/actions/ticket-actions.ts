"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { format } from "date-fns";
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

  const { data: category } = await supabase
    .from("ticket_categories")
    .select("price, quantity_total, match_id")
    .eq("id", categoryId)
    .single();

  if (!category) return { error: "Catégorie introuvable" };

  const { data: match } = await supabase
    .from("matches")
    .select("status, vente_active")
    .eq("id", matchId)
    .single();

  if (!match) return { error: "Match introuvable" };
  if (match.status === "termine" || match.status === "annule") {
    return { error: "Ce match est terminé" };
  }
  if (!match.vente_active) {
    return { error: "La vente n'est pas ouverte pour ce match" };
  }

  const { count: soldCount } = await supabase
    .from("tickets")
    .select("*", { count: "exact", head: true })
    .eq("category_id", categoryId)
    .neq("status", "annule");

  const remaining = category.quantity_total - (soldCount || 0);
  if (remaining <= 0) {
    return { error: "Plus de billets disponibles dans cette catégorie" };
  }
  if (qty > remaining) {
    return { error: `Seulement ${remaining} billet(s) disponible(s)` };
  }

  const today = format(new Date(), "yyyyMMdd");

  const { count: todayCount } = await supabase
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

  const { data: inserted, error } = await supabase
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

export async function validateTicket(qrToken: string): Promise<ScanResult> {
  const supabase = await createClient();
  const adminClient = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { status: "invalid", message: "Non authentifié" };

  const { data: userProfile } = await supabase
    .from("profiles")
    .select("zone_id")
    .eq("id", user.id)
    .single();

  const { data: ticket } = await adminClient
    .from("tickets")
    .select(
      "*, match:matches(zone_id, home_team, away_team), category:ticket_categories(name)"
    )
    .eq("qr_token", qrToken)
    .single();

  if (!ticket) {
    return { status: "invalid", message: "Billet invalide" };
  }

  if ((ticket as any).match?.zone_id !== userProfile?.zone_id) {
    return { status: "invalid", message: "Billet d'une autre zone" };
  }

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

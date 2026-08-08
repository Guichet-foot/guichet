"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/* eslint-disable @typescript-eslint/no-explicit-any */

const DEMO_ACCOUNT_ID = "aa984bd3-7493-41d3-bad0-7a9c733ba51e";

export interface FinanceRow {
  accountKey: string;           // "{type}::{accountId}::{date}" — clé de paiement
  date: string;                 // YYYY-MM-DD
  organisateur: string;         // "Zone 14F", "Thierno Diallo", "ODCAV"
  organisateurType: "zone" | "c3" | "odcav";
  billetsPrinted: number;       // nombre brut de billets imprimés
  blocsImprimes: number;        // Math.floor(billetsPrinted / 100)
  billetsScanned: number;       // billets validés (= même source que page admin)
  frais: number;                // billetsScanned × 10 FCFA
  paid: boolean;
  paidAt: string | null;
}

export async function getFinancesData(): Promise<FinanceRow[]> {
  await requireRole(["fondateur"]);
  const supabase = await createAdminClient();

  // ── 1. Données de base ─────────────────────────────────────────────
  const [matchesRes, zonesRes, c3ProfilesRes, paymentsRes] = await Promise.all([
    supabase.from("matches").select("id, match_date, zone_id, c3_account_id, status").neq("status", "annule"),
    supabase.from("zones").select("id, name, created_by"),
    supabase.from("profiles").select("id, full_name").eq("role", "c3"),
    supabase.from("fondateur_payments").select("account_key, paid, paid_at"),
  ]);

  const matches     = (matchesRes.data   || []) as any[];
  const zones       = (zonesRes.data     || []) as { id: string; name: string; created_by: string }[];
  const c3Profiles  = (c3ProfilesRes.data || []) as { id: string; full_name: string }[];

  const zoneMap     = new Map(zones.map(z => [z.id, z]));
  const c3Map       = new Map(c3Profiles.map(p => [p.id, p]));
  const demoZoneIds = new Set(zones.filter(z => z.created_by === DEMO_ACCOUNT_ID).map(z => z.id));
  const paymentsMap = new Map(
    (paymentsRes.data || []).map((p: any) => [
      p.account_key as string,
      { paid: p.paid as boolean, paidAt: p.paid_at as string | null },
    ])
  );

  // ── 2. Filtrer les matchs valides (pas demo, pas sans date) ────────
  const validMatches = matches.filter((m: any) => {
    if (!m.match_date) return false;
    if (m.zone_id && demoZoneIds.has(m.zone_id as string)) return false;
    return true;
  });
  if (validMatches.length === 0) return [];

  const allMatchIds = validMatches.map((m: any) => m.id as string);
  const matchMap    = new Map(validMatches.map((m: any) => [m.id as string, m]));

  // ── 3. Regrouper par (type, accountId, date) ───────────────────────
  type GroupType = "zone" | "c3" | "odcav";
  interface GroupInfo { type: GroupType; accountId: string; date: string; matchIds: string[] }
  const groupMap = new Map<string, GroupInfo>();

  for (const m of validMatches) {
    const date = (m.match_date as string).split("T")[0];
    let type: GroupType;
    let accountId: string;

    if (m.c3_account_id) {
      type = "c3";
      accountId = m.c3_account_id as string;
    } else if (m.zone_id) {
      type = "zone";
      accountId = m.zone_id as string;
    } else {
      type = "odcav";
      accountId = "odcav";
    }

    const key = `${type}::${accountId}::${date}`;
    if (!groupMap.has(key)) groupMap.set(key, { type, accountId, date, matchIds: [] });
    groupMap.get(key)!.matchIds.push(m.id as string);
  }

  // ── 4. Tickets zones/ODCAV (table tickets) ────────────────────────
  const { data: ticketsData } = await supabase
    .from("tickets")
    .select("match_id, status, bloc_printed")
    .in("match_id", allMatchIds);

  const ticketPrinted = new Map<string, number>();
  const ticketScanned = new Map<string, number>();
  for (const t of ticketsData || []) {
    const mid = t.match_id as string;
    if (t.bloc_printed) ticketPrinted.set(mid, (ticketPrinted.get(mid) || 0) + 1);
    if (t.status === "scanne") ticketScanned.set(mid, (ticketScanned.get(mid) || 0) + 1);
  }

  // ── 5. Scans billetterie C3/ODCAV (table billeterie_scans) ────────
  const { data: bilScansData } = await supabase
    .from("billeterie_scans")
    .select("match_id")
    .in("match_id", allMatchIds);

  const bilScannedByMatch = new Map<string, number>();
  for (const s of bilScansData || []) {
    const mid = s.match_id as string;
    bilScannedByMatch.set(mid, (bilScannedByMatch.get(mid) || 0) + 1);
  }

  // ── 6. Billets imprimés C3 (billeterie_tickets non retirés) ───────
  const c3MatchIdSet = new Set(validMatches.filter((m: any) => m.c3_account_id).map((m: any) => m.id as string));
  const bilPrintedByGroupKey = new Map<string, number>();

  if (c3MatchIdSet.size > 0) {
    const { data: allBilsData } = await supabase.from("billeterie").select("id, match_ids");
    const c3Bils = (allBilsData || []).filter((b: any) =>
      (b.match_ids as string[] || []).some((id) => c3MatchIdSet.has(id))
    );

    if (c3Bils.length > 0) {
      const c3BilIds = c3Bils.map((b: any) => b.id as string);
      const { data: bilTicketsData } = await supabase
        .from("billeterie_tickets")
        .select("billeterie_id, withdrawn")
        .in("billeterie_id", c3BilIds);

      // Compter les billets non retirés par billetterie
      const nonWithdrawnByBil = new Map<string, number>();
      for (const t of bilTicketsData || []) {
        if (!t.withdrawn) {
          const bid = t.billeterie_id as string;
          nonWithdrawnByBil.set(bid, (nonWithdrawnByBil.get(bid) || 0) + 1);
        }
      }

      // Attribuer les billets imprimés à chaque groupe (c3, date)
      for (const b of c3Bils as any[]) {
        const nonWithdrawn = nonWithdrawnByBil.get(b.id as string) || 0;
        if (nonWithdrawn === 0) continue;
        const seenKeys = new Set<string>();
        for (const matchId of (b.match_ids as string[] || [])) {
          const m = matchMap.get(matchId);
          if (!m || !m.c3_account_id) continue;
          const date = (m.match_date as string).split("T")[0];
          const gk = `c3::${m.c3_account_id as string}::${date}`;
          if (!seenKeys.has(gk) && groupMap.has(gk)) {
            seenKeys.add(gk);
            bilPrintedByGroupKey.set(gk, (bilPrintedByGroupKey.get(gk) || 0) + nonWithdrawn);
          }
        }
      }
    }
  }

  // ── 7. Construire les lignes ───────────────────────────────────────
  const today = new Date().toISOString().split("T")[0];
  const rows: FinanceRow[] = [];

  for (const [accountKey, group] of groupMap) {
    // Ne pas afficher les dates futures
    if (group.date > today) continue;

    let billetsPrinted = 0;
    let billetsScanned = 0;

    if (group.type === "zone") {
      for (const mid of group.matchIds) {
        billetsPrinted += ticketPrinted.get(mid) || 0;
        billetsScanned += ticketScanned.get(mid) || 0;
      }
    } else if (group.type === "c3") {
      billetsPrinted = bilPrintedByGroupKey.get(accountKey) || 0;
      for (const mid of group.matchIds) {
        billetsScanned += bilScannedByMatch.get(mid) || 0;
      }
    } else {
      // ODCAV : tickets réguliers + scans billetterie
      for (const mid of group.matchIds) {
        billetsPrinted += ticketPrinted.get(mid) || 0;
        billetsScanned += (ticketScanned.get(mid) || 0) + (bilScannedByMatch.get(mid) || 0);
      }
    }

    // Ne pas afficher les comptes sans aucun scan ce jour-là
    if (billetsScanned === 0) continue;

    const organisateur =
      group.type === "c3"    ? (c3Map.get(group.accountId)?.full_name || "C3") :
      group.type === "zone"  ? (zoneMap.get(group.accountId)?.name    || "Zone") :
      "ODCAV";

    const payment = paymentsMap.get(accountKey);

    rows.push({
      accountKey,
      date: group.date,
      organisateur,
      organisateurType: group.type,
      billetsPrinted,
      blocsImprimes: Math.floor(billetsPrinted / 100),
      billetsScanned,
      frais: billetsScanned * 10,
      paid: payment?.paid ?? false,
      paidAt: payment?.paidAt ?? null,
    });
  }

  rows.sort((a, b) => b.date.localeCompare(a.date) || a.organisateur.localeCompare(b.organisateur));
  return rows;
}

export async function toggleFinancePayment(accountKey: string, paid: boolean) {
  await requireRole(["fondateur"]);
  const supabase = await createAdminClient();

  const { error } = await supabase.from("fondateur_payments").upsert(
    { account_key: accountKey, paid, paid_at: paid ? new Date().toISOString() : null },
    { onConflict: "account_key" }
  );

  if (error) return { error: error.message };
  revalidatePath("/fondateur/finances");
  return { success: true };
}

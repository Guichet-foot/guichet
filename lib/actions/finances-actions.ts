"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { fetchAll } from "@/lib/supabase/paginate";

/* eslint-disable @typescript-eslint/no-explicit-any */

const DEMO_ACCOUNT_ID = "aa984bd3-7493-41d3-bad0-7a9c733ba51e";

export interface FinanceRow {
  accountKey: string;           // "type::accountId::scanDate"
  date: string;                 // YYYY-MM-DD (date des scans)
  organisateur: string;
  organisateurType: "zone" | "c3" | "odcav";
  billetsPrinted: number;
  blocsImprimes: number;        // Math.floor(billetsPrinted / 100)
  billetsScanned: number;
  frais: number;                // billetsScanned × 10 FCFA
  paid: boolean;
  paidAt: string | null;
}

export async function getFinancesData(): Promise<FinanceRow[]> {
  await requireRole(["fondateur"]);
  const supabase = await createAdminClient();

  const today = new Date().toISOString().split("T")[0];

  // ── 1. Données de base ─────────────────────────────────────────────
  const [matchesRes, zonesRes, c3ProfilesRes, paymentsRes] = await Promise.all([
    supabase.from("matches").select("id, match_date, zone_id, c3_account_id, status").neq("status", "annule"),
    supabase.from("zones").select("id, name, created_by"),
    supabase.from("profiles").select("id, full_name").eq("role", "c3"),
    supabase.from("fondateur_payments").select("account_key, paid, paid_at"),
  ]);

  const matches    = (matchesRes.data    || []) as any[];
  const zones      = (zonesRes.data      || []) as any[];
  const c3Profiles = (c3ProfilesRes.data || []) as any[];

  const zoneMap     = new Map(zones.map((z: any) => [z.id as string, z]));
  const c3Map       = new Map(c3Profiles.map((p: any) => [p.id as string, p]));
  const demoZoneIds = new Set(zones.filter((z: any) => z.created_by === DEMO_ACCOUNT_ID).map((z: any) => z.id as string));
  const paymentsMap = new Map(
    (paymentsRes.data || []).map((p: any) => [
      p.account_key as string,
      { paid: p.paid as boolean, paidAt: p.paid_at as string | null },
    ])
  );

  // ── 2. Matchs valides ──────────────────────────────────────────────
  const validMatches = matches.filter((m: any) => {
    if (!m.match_date) return false;
    if (m.zone_id && demoZoneIds.has(m.zone_id as string)) return false;
    return true;
  });
  if (validMatches.length === 0) return [];

  const matchMap     = new Map(validMatches.map((m: any) => [m.id as string, m]));
  const zoneMatchIds = validMatches.filter((m: any) => m.zone_id && !m.c3_account_id).map((m: any) => m.id as string);
  const c3MatchIds   = validMatches.filter((m: any) => m.c3_account_id).map((m: any) => m.id as string);
  const c3MatchIdSet = new Set(c3MatchIds);
  const odcavMatchIds = validMatches.filter((m: any) => !m.zone_id && !m.c3_account_id).map((m: any) => m.id as string);

  // Accumulateurs : scanKey = "type::accountId::scanDate"
  const scansByGroup        = new Map<string, number>();
  const matchesByScanGroup  = new Map<string, Set<string>>(); // pour billets imprimés zone
  const printedByMatchId    = new Map<string, number>();
  const c3PrintedByKey      = new Map<string, number>();

  // ── 3. Zone + ODCAV : tickets (avec pagination) ────────────────────
  const regularMatchIds = [...zoneMatchIds, ...odcavMatchIds];
  if (regularMatchIds.length > 0) {
    const allTickets = await fetchAll<any>((from, to) =>
      supabase
        .from("tickets")
        .select("match_id, status, bloc_printed, scanned_at")
        .in("match_id", regularMatchIds)
        .range(from, to)
    );

    for (const t of allTickets) {
      const m = matchMap.get(t.match_id as string);
      if (!m) continue;

      const type      = m.zone_id ? "zone" : "odcav";
      const accountId = (m.zone_id as string | null) || "odcav";

      if (t.bloc_printed) {
        printedByMatchId.set(t.match_id as string, (printedByMatchId.get(t.match_id as string) || 0) + 1);
      }

      if (t.status === "scanne" && t.scanned_at) {
        const scanDate = (t.scanned_at as string).split("T")[0];
        if (scanDate > today) continue;
        const sk = `${type}::${accountId}::${scanDate}`;
        scansByGroup.set(sk, (scansByGroup.get(sk) || 0) + 1);
        if (!matchesByScanGroup.has(sk)) matchesByScanGroup.set(sk, new Set());
        matchesByScanGroup.get(sk)!.add(t.match_id as string);
      }
    }
  }

  // ── 4. C3 : billeteries → scans (même logique que la page admin) ───
  // On passe par match_id → billeterie → c3_account_id.
  // Pas besoin de ticket_id : un match appartient à UNE seule billetterie C3.
  // On utilise fetchAll pour dépasser la limite de 1000 lignes Supabase.
  if (c3MatchIds.length > 0) {
    const { data: allBilsData } = await supabase.from("billeterie").select("id, match_ids");
    const c3Bils = (allBilsData || []).filter((b: any) =>
      ((b.match_ids as string[]) || []).some((id) => c3MatchIdSet.has(id))
    );

    if (c3Bils.length > 0) {
      // match_id → billeterie_id (premier match C3 dans la billetterie)
      const matchIdToBilId = new Map<string, string>();
      // billeterie_id → c3_account_id
      const bilToC3Id = new Map<string, string>();

      for (const b of c3Bils as any[]) {
        for (const mid of (b.match_ids as string[]) || []) {
          matchIdToBilId.set(mid, b.id as string);
          const m = matchMap.get(mid);
          if (m?.c3_account_id && !bilToC3Id.has(b.id as string)) {
            bilToC3Id.set(b.id as string, m.c3_account_id as string);
          }
        }
      }

      // Tous les match IDs dans les billeteries C3 (y compris matchs ODCAV associés)
      const allBilMatchIds = [...new Set(
        (c3Bils as any[]).flatMap((b: any) => (b.match_ids as string[]) || [])
      )];

      const bilIds = (c3Bils as any[]).map((b: any) => b.id as string);

      // Scans et billets en parallèle — avec pagination pour éviter la limite 1000
      const [allBilScans, allBilTickets] = await Promise.all([
        fetchAll<any>((from, to) =>
          supabase
            .from("billeterie_scans")
            .select("match_id, scanned_at")   // pas besoin de ticket_id
            .in("match_id", allBilMatchIds)
            .range(from, to)
        ),
        fetchAll<any>((from, to) =>
          supabase
            .from("billeterie_tickets")
            .select("billeterie_id, withdrawn")
            .in("billeterie_id", bilIds)
            .range(from, to)
        ),
      ]);

      // Compter les billets non retirés par billetterie
      const nonWithdrawnByBil = new Map<string, number>();
      for (const t of allBilTickets) {
        if (!t.withdrawn) {
          nonWithdrawnByBil.set(
            t.billeterie_id as string,
            (nonWithdrawnByBil.get(t.billeterie_id as string) || 0) + 1
          );
        }
      }

      // Dates de scan par billetterie (pour attribuer les billets imprimés)
      const bilScanDates = new Map<string, Set<string>>();

      for (const s of allBilScans) {
        if (!s.scanned_at) continue;
        const scanDate = (s.scanned_at as string).split("T")[0];
        if (scanDate > today) continue;

        const bilId = matchIdToBilId.get(s.match_id as string);
        if (!bilId) continue;
        const c3Id = bilToC3Id.get(bilId);
        if (!c3Id) continue;

        const sk = `c3::${c3Id}::${scanDate}`;
        scansByGroup.set(sk, (scansByGroup.get(sk) || 0) + 1);

        if (!bilScanDates.has(bilId)) bilScanDates.set(bilId, new Set());
        bilScanDates.get(bilId)!.add(scanDate);
      }

      // Attribuer billets imprimés à chaque (c3, scanDate)
      for (const b of c3Bils as any[]) {
        const c3Id        = bilToC3Id.get(b.id as string);
        const nonWithdrawn = nonWithdrawnByBil.get(b.id as string) || 0;
        const scanDates   = bilScanDates.get(b.id as string);
        if (!c3Id || !scanDates) continue;
        for (const scanDate of scanDates) {
          const pk = `c3::${c3Id}::${scanDate}`;
          c3PrintedByKey.set(pk, (c3PrintedByKey.get(pk) || 0) + nonWithdrawn);
        }
      }
    }
  }

  // ── 5. Construire les lignes ───────────────────────────────────────
  const rows: FinanceRow[] = [];

  for (const [scanKey, billetsScanned] of scansByGroup) {
    if (billetsScanned === 0) continue;

    // Parse scanKey = "type::accountId::scanDate"
    // UUID peut contenir des tirets mais pas "::", donc split("::") est sûr
    const parts     = scanKey.split("::");
    const type      = parts[0] as "zone" | "c3" | "odcav";
    const accountId = parts[1];
    const scanDate  = parts[2];

    let billetsPrinted = 0;
    if (type === "c3") {
      billetsPrinted = c3PrintedByKey.get(scanKey) || 0;
    } else {
      const matchIds = matchesByScanGroup.get(scanKey) || new Set<string>();
      for (const mid of matchIds) billetsPrinted += printedByMatchId.get(mid) || 0;
    }

    const organisateur =
      type === "c3"   ? (c3Map.get(accountId)?.full_name || "C3") :
      type === "zone" ? (zoneMap.get(accountId)?.name    || "Zone") :
      "ODCAV";

    const payment = paymentsMap.get(scanKey);

    rows.push({
      accountKey: scanKey,
      date: scanDate,
      organisateur,
      organisateurType: type,
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

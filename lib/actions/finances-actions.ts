"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";

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

  // ── 2. Matchs valides (pas demo, pas sans date) ────────────────────
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

  // scansByGroup : "type::accountId::scanDate" → nombre de scans
  const scansByGroup = new Map<string, number>();
  // matchesByScanGroup : scanKey → Set<matchId> (pour retrouver les billets imprimés)
  const matchesByScanGroup = new Map<string, Set<string>>();
  // printedByMatchId : matchId → billets imprimés (bloc_printed)
  const printedByMatchId = new Map<string, number>();

  // ── 3. Tickets Zone + ODCAV (groupés par date de SCAN) ────────────
  const regularMatchIds = [...zoneMatchIds, ...odcavMatchIds];
  if (regularMatchIds.length > 0) {
    const { data: ticketsData } = await supabase
      .from("tickets")
      .select("match_id, status, bloc_printed, scanned_at")
      .in("match_id", regularMatchIds);

    for (const t of ticketsData || []) {
      const m = matchMap.get(t.match_id as string);
      if (!m) continue;

      const type      = m.zone_id ? "zone" : "odcav";
      const accountId = (m.zone_id as string | null) || "odcav";

      // Compter les billets imprimés par match (référence fixe)
      if (t.bloc_printed) {
        printedByMatchId.set(t.match_id as string, (printedByMatchId.get(t.match_id as string) || 0) + 1);
      }

      // Compter les scans par date de scan
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

  // ── 4. C3 : billeterie → scans (même logique que la page admin C3) ─
  // Clé : la page admin filtre billeterie_scans par scanned_at ET par
  // ticket appartenant aux billeteries du C3 (incluant les matchs ODCAV
  // dans les mêmes billeteries). On réplique exactement ce comportement.
  const c3PrintedByKey = new Map<string, number>(); // scanKey → billets imprimés C3

  if (c3MatchIds.length > 0) {
    // Trouver toutes les billeteries liées aux matchs C3
    const { data: allBilsData } = await supabase.from("billeterie").select("id, match_ids");
    const c3Bils = (allBilsData || []).filter((b: any) =>
      ((b.match_ids as string[]) || []).some((id) => c3MatchIdSet.has(id))
    );

    if (c3Bils.length > 0) {
      // Déterminer c3_account_id pour chaque billetterie
      const bilToC3Id = new Map<string, string>();
      for (const b of c3Bils as any[]) {
        for (const mid of (b.match_ids as string[]) || []) {
          const m = matchMap.get(mid);
          if (m?.c3_account_id) {
            bilToC3Id.set(b.id as string, m.c3_account_id as string);
            break;
          }
        }
      }

      // Tous les matchs des billeteries C3 (y compris ODCAV associés)
      const allBilMatchIds = [...new Set(
        (c3Bils as any[]).flatMap((b: any) => (b.match_ids as string[]) || [])
      )];

      const bilIds = (c3Bils as any[]).map((b: any) => b.id as string);

      // Scans + tickets en parallèle
      const [bilScansRes, bilTicketsRes] = await Promise.all([
        supabase.from("billeterie_scans").select("ticket_id, scanned_at").in("match_id", allBilMatchIds),
        supabase.from("billeterie_tickets").select("id, billeterie_id, withdrawn").in("billeterie_id", bilIds),
      ]);

      // Construire la map ticket → billetterie + comptage non-retirés
      const ticketIdToBilId   = new Map<string, string>();
      const nonWithdrawnByBil = new Map<string, number>();
      for (const t of bilTicketsRes.data || []) {
        ticketIdToBilId.set(t.id as string, t.billeterie_id as string);
        if (!t.withdrawn) {
          nonWithdrawnByBil.set(
            t.billeterie_id as string,
            (nonWithdrawnByBil.get(t.billeterie_id as string) || 0) + 1
          );
        }
      }

      // Enregistrer les dates de scan par billetterie (pour les billets imprimés)
      const bilScanDates = new Map<string, Set<string>>();

      for (const s of bilScansRes.data || []) {
        if (!s.scanned_at) continue;
        const scanDate = (s.scanned_at as string).split("T")[0];
        if (scanDate > today) continue;

        // Seuls les tickets appartenant aux billeteries C3 sont comptabilisés
        const bilId = ticketIdToBilId.get(s.ticket_id as string);
        if (!bilId) continue;
        const c3Id = bilToC3Id.get(bilId);
        if (!c3Id) continue;

        const sk = `c3::${c3Id}::${scanDate}`;
        scansByGroup.set(sk, (scansByGroup.get(sk) || 0) + 1);

        if (!bilScanDates.has(bilId)) bilScanDates.set(bilId, new Set());
        bilScanDates.get(bilId)!.add(scanDate);
      }

      // Attribuer les billets imprimés (non retirés) à chaque (c3, scanDate)
      for (const b of c3Bils as any[]) {
        const c3Id        = bilToC3Id.get(b.id as string);
        const nonWithdrawn = nonWithdrawnByBil.get(b.id as string) || 0;
        const scanDates   = bilScanDates.get(b.id as string);
        if (!c3Id || nonWithdrawn === 0 || !scanDates) continue;
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

    // scanKey format: "type::accountId::scanDate"
    const colonIdx  = scanKey.indexOf("::");
    const rest      = scanKey.slice(colonIdx + 2);
    const colon2    = rest.lastIndexOf("::");
    const type      = scanKey.slice(0, colonIdx) as "zone" | "c3" | "odcav";
    const accountId = rest.slice(0, colon2);
    const scanDate  = rest.slice(colon2 + 2);

    // Billets imprimés
    let billetsPrinted = 0;
    if (type === "c3") {
      billetsPrinted = c3PrintedByKey.get(scanKey) || 0;
    } else {
      // Sommer les billets imprimés pour tous les matchs scannés ce jour-là
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

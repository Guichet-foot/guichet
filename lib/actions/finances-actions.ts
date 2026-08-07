"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/* eslint-disable @typescript-eslint/no-explicit-any */

const DEMO_ACCOUNT_ID = "aa984bd3-7493-41d3-bad0-7a9c733ba51e";
const FEE_PER_SCAN = 10; // FCFA par billet validé

export interface FinanceRow {
  matchId: string;
  date: string;
  organisateur: string;       // "C3 Nguekokh", "Zone 5A", "ODCAV"
  organisateurType: "zone" | "c3" | "odcav";
  billetsPrinted: number;     // billets imprimés (bloc_printed)
  billetsScanned: number;     // billets validés
  frais: number;              // billetsScanned × FEE_PER_SCAN
  paid: boolean;
  paidAt: string | null;
}

export async function getFinancesData(): Promise<FinanceRow[]> {
  await requireRole(["fondateur"]);
  const supabase = await createAdminClient();

  const [matchesRes, zonesRes, profilesRes, paymentsRes] = await Promise.all([
    supabase
      .from("matches")
      .select("id, match_date, home_team, away_team, zone_id, home_team_zone, away_team_zone, c3_account_id, is_direct, status")
      .neq("status", "annule"),
    supabase.from("zones").select("id, name, created_by"),
    supabase.from("profiles").select("id, full_name, role"),
    supabase.from("match_payments").select("match_id, paid, paid_at"),
  ]);

  const matches = (matchesRes.data || []) as any[];
  const zones = (zonesRes.data || []) as { id: string; name: string; created_by: string }[];
  const profiles = (profilesRes.data || []) as { id: string; full_name: string; role: string }[];
  const paymentsMap = new Map<string, { paid: boolean; paidAt: string | null }>(
    (paymentsRes.data || []).map((p: any) => [
      p.match_id as string,
      { paid: p.paid as boolean, paidAt: p.paid_at as string | null },
    ])
  );

  const zoneMap = new Map(zones.map((z) => [z.id, z]));
  const profileMap = new Map(profiles.map((p) => [p.id, p]));
  const demoZoneIds = new Set(zones.filter((z) => z.created_by === DEMO_ACCOUNT_ID).map((z) => z.id));

  // Filter valid matches
  const validMatches = matches.filter((m) => {
    if (!m.match_date) return false;
    if (m.zone_id && demoZoneIds.has(m.zone_id as string)) return false;
    return true;
  });

  if (validMatches.length === 0) return [];

  const matchIds = validMatches.map((m) => m.id as string);

  // Fetch ticket counts in bulk
  const [ticketsRes, bilScansRes] = await Promise.all([
    supabase
      .from("tickets")
      .select("match_id, bloc_printed, status, counts_as_revenue")
      .in("match_id", matchIds)
      .neq("status", "annule"),
    supabase
      .from("billeterie_scans")
      .select("match_id")
      .in("match_id", matchIds),
  ]);

  // Aggregate per match
  const printedByMatch = new Map<string, number>();
  const scannedByMatch = new Map<string, number>();

  for (const t of ticketsRes.data || []) {
    const mid = t.match_id as string;
    if (t.bloc_printed) printedByMatch.set(mid, (printedByMatch.get(mid) || 0) + 1);
    if (t.status === "scanne" && t.counts_as_revenue) {
      scannedByMatch.set(mid, (scannedByMatch.get(mid) || 0) + 1);
    }
  }
  for (const s of bilScansRes.data || []) {
    const mid = s.match_id as string;
    scannedByMatch.set(mid, (scannedByMatch.get(mid) || 0) + 1);
  }

  const rows: FinanceRow[] = [];

  for (const m of validMatches) {
    const dateStr = (m.match_date as string).split("T")[0];
    const billetsPrinted = printedByMatch.get(m.id as string) || 0;
    const billetsScanned = scannedByMatch.get(m.id as string) || 0;
    const frais = billetsScanned * FEE_PER_SCAN;

    let organisateur: string;
    let organisateurType: "zone" | "c3" | "odcav";

    if (m.c3_account_id) {
      organisateurType = "c3";
      const c3 = profileMap.get(m.c3_account_id as string);
      organisateur = c3?.full_name || "C3";
    } else if (m.zone_id) {
      organisateurType = "zone";
      const zone = zoneMap.get(m.zone_id as string);
      organisateur = zone?.name || "Zone inconnue";
    } else {
      organisateurType = "odcav";
      const homeZone = m.home_team_zone ? zoneMap.get(m.home_team_zone as string)?.name : null;
      const awayZone = m.away_team_zone ? zoneMap.get(m.away_team_zone as string)?.name : null;
      const parts = [homeZone, awayZone].filter(Boolean);
      organisateur = parts.length > 0 ? `ODCAV · ${parts.join(" / ")}` : "ODCAV";
    }

    const payment = paymentsMap.get(m.id as string);

    rows.push({
      matchId: m.id as string,
      date: dateStr,
      organisateur,
      organisateurType,
      billetsPrinted,
      billetsScanned,
      frais,
      paid: payment?.paid ?? false,
      paidAt: payment?.paidAt ?? null,
    });
  }

  rows.sort((a, b) => b.date.localeCompare(a.date));
  return rows;
}

export async function toggleMatchPayment(matchId: string, paid: boolean) {
  await requireRole(["fondateur"]);
  const supabase = await createAdminClient();

  const { error } = await supabase.from("match_payments").upsert(
    { match_id: matchId, paid, paid_at: paid ? new Date().toISOString() : null },
    { onConflict: "match_id" }
  );

  if (error) return { error: error.message };
  revalidatePath("/fondateur/finances");
  return { success: true };
}

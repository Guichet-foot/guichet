"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/* eslint-disable @typescript-eslint/no-explicit-any */

const DEMO_ACCOUNT_ID = "aa984bd3-7493-41d3-bad0-7a9c733ba51e";

export interface FinanceRow {
  matchId: string;
  date: string;
  matchName: string;
  type: "zone" | "c3" | "odcav";
  organisateur: string;
  zoneNames: string[];
  frais: number;
  billingUnits: number;
  paid: boolean;
  paidAt: string | null;
  matchStatus: string;
}

function getFraisForDate(
  platformHistory: { fee_per_block: number; effective_date: string }[],
  dateStr: string
): number {
  let frais = 1000;
  for (const row of platformHistory) {
    if (row.effective_date <= dateStr) frais = row.fee_per_block ?? 1000;
    else break;
  }
  return frais;
}

export async function getFinancesData(): Promise<FinanceRow[]> {
  await requireRole(["fondateur"]);
  const supabase = await createAdminClient();

  const [matchesRes, zonesRes, profilesRes, platformRes, paymentsRes] = await Promise.all([
    supabase.from("matches").select("id, match_date, home_team, away_team, zone_id, home_team_zone, away_team_zone, c3_account_id, is_direct, status, created_by").neq("status", "annule"),
    supabase.from("zones").select("id, name, created_by"),
    supabase.from("profiles").select("id, full_name, role"),
    supabase.from("platform_settings").select("fee_per_block, effective_date").order("effective_date", { ascending: true }),
    supabase.from("match_payments").select("match_id, paid, paid_at"),
  ]);

  const matches = (matchesRes.data || []) as any[];
  const zones = (zonesRes.data || []) as { id: string; name: string; created_by: string }[];
  const profiles = (profilesRes.data || []) as { id: string; full_name: string; role: string }[];
  const platformHistory = (platformRes.data || []) as { fee_per_block: number; effective_date: string }[];
  const paymentsMap = new Map<string, { paid: boolean; paidAt: string | null }>(
    (paymentsRes.data || []).map((p: any) => [p.match_id as string, { paid: p.paid as boolean, paidAt: p.paid_at as string | null }])
  );

  const zoneMap = new Map(zones.map((z) => [z.id, z]));
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  // Demo zone IDs to exclude
  const demoZoneIds = new Set(zones.filter((z) => z.created_by === DEMO_ACCOUNT_ID).map((z) => z.id));

  const rows: FinanceRow[] = [];

  for (const m of matches) {
    // Skip demo matches
    if (m.zone_id && demoZoneIds.has(m.zone_id as string)) continue;
    if (!m.match_date) continue;

    const dateStr = (m.match_date as string).split("T")[0];
    const fraisPerUnit = getFraisForDate(platformHistory, dateStr);

    let type: "zone" | "c3" | "odcav";
    let organisateur: string;
    let zoneNames: string[] = [];
    let billingUnits: number;

    if (m.c3_account_id) {
      // C3 match
      type = "c3";
      const c3Profile = profileMap.get(m.c3_account_id as string);
      organisateur = c3Profile?.full_name || "C3 inconnu";
      billingUnits = 1;
      if (m.zone_id) {
        const z = zoneMap.get(m.zone_id as string);
        if (z) zoneNames = [z.name];
      }
    } else if (m.zone_id) {
      // Zone match
      type = "zone";
      const zone = zoneMap.get(m.zone_id as string);
      zoneNames = zone ? [zone.name] : [];
      const saProfile = zone ? profileMap.get(zone.created_by) : null;
      organisateur = saProfile?.full_name || zone?.name || "Zone inconnue";
      billingUnits = 1;
    } else {
      // ODCAV / direct match
      type = "odcav";
      const homeZone = m.home_team_zone ? zoneMap.get(m.home_team_zone as string) : null;
      const awayZone = m.away_team_zone ? zoneMap.get(m.away_team_zone as string) : null;
      zoneNames = [homeZone?.name, awayZone?.name].filter(Boolean) as string[];
      organisateur = "ODCAV";
      billingUnits = Math.max(1, zoneNames.length > 0 ? (homeZone ? 1 : 0) + (awayZone ? 1 : 0) : 1);
    }

    const payment = paymentsMap.get(m.id as string);

    rows.push({
      matchId: m.id as string,
      date: dateStr,
      matchName: `${m.home_team} vs ${m.away_team}`,
      type,
      organisateur,
      zoneNames,
      frais: fraisPerUnit * billingUnits,
      billingUnits,
      paid: payment?.paid ?? false,
      paidAt: payment?.paidAt ?? null,
      matchStatus: m.status as string,
    });
  }

  // Sort by date desc
  rows.sort((a, b) => b.date.localeCompare(a.date));
  return rows;
}

export async function toggleMatchPayment(matchId: string, paid: boolean) {
  await requireRole(["fondateur"]);
  const supabase = await createAdminClient();

  const { error } = await supabase.from("match_payments").upsert(
    {
      match_id: matchId,
      paid,
      paid_at: paid ? new Date().toISOString() : null,
    },
    { onConflict: "match_id" }
  );

  if (error) return { error: error.message };
  revalidatePath("/fondateur/finances");
  return { success: true };
}

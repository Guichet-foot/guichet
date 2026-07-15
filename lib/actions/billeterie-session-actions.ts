"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

// ── Helper : passe les matchs du jour en "En cours" ──────────────────────────

async function setTodayMatchesEnCours(filter: {
  zoneId?: string;
  c3AccountId?: string;
  odcav?: boolean;
}) {
  const adminClient = await createAdminClient();

  // ODCAV matches have no zone_id and may span multiple days — set ALL
  // programme communal/départemental matches en_cours regardless of date.
  if (filter.odcav) {
    await adminClient
      .from("matches")
      .update({ status: "en_cours" })
      .eq("status", "programme")
      .in("match_type", ["Match Communal", "Match Départemental"]);
    return;
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = adminClient
    .from("matches")
    .update({ status: "en_cours" })
    .eq("status", "programme")
    .gte("match_date", todayStart.toISOString())
    .lte("match_date", todayEnd.toISOString());

  if (filter.zoneId) {
    query = query.eq("zone_id", filter.zoneId);
  } else if (filter.c3AccountId) {
    query = query.eq("c3_account_id", filter.c3AccountId);
  }

  await query;
}

// ── Sessions de zone ──────────────────────────────────────────────────────────

export async function openBilleterieSession(zoneId: string) {
  await requireRole(["super_admin", "admin_zone", "fondateur", "president_odcav"]);
  const adminClient = await createAdminClient();
  const openUntil = new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString();

  const { error } = await adminClient
    .from("zones")
    .update({ billeterie_open_until: openUntil })
    .eq("id", zoneId);
  if (error) return { error: error.message };

  await setTodayMatchesEnCours({ zoneId });
  return { success: true, openUntil };
}

export async function closeBilleterieSession(zoneId: string) {
  await requireRole(["super_admin", "admin_zone", "fondateur", "president_odcav"]);
  const adminClient = await createAdminClient();
  const { error } = await adminClient
    .from("zones")
    .update({ billeterie_open_until: null })
    .eq("id", zoneId);
  if (error) return { error: error.message };
  return { success: true };
}

// ── Sessions C3 ───────────────────────────────────────────────────────────────

export async function openC3ScanSession(c3AccountId: string) {
  // Allow c3, super_admin, fondateur, president_odcav so ODCAV admins can start
  // a C3 session for their portiers without requiring the C3 to be logged in.
  await requireRole(["c3", "super_admin", "fondateur", "president_odcav"]);
  const adminClient = await createAdminClient();
  const openUntil = new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString();

  const { error } = await adminClient
    .from("scan_sessions")
    .upsert({ scope: c3AccountId, open_until: openUntil, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };

  await setTodayMatchesEnCours({ c3AccountId });
  return { success: true, openUntil };
}

export async function closeC3ScanSession(c3AccountId: string) {
  await requireRole(["c3", "super_admin", "fondateur", "president_odcav"]);
  const adminClient = await createAdminClient();
  const { error } = await adminClient
    .from("scan_sessions")
    .upsert({ scope: c3AccountId, open_until: null, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };
  return { success: true };
}

export async function getC3ScanSession(c3AccountId: string): Promise<string | null> {
  const adminClient = await createAdminClient();
  const { data } = await adminClient
    .from("scan_sessions")
    .select("open_until")
    .eq("scope", c3AccountId)
    .maybeSingle();
  const openUntil = data?.open_until || null;
  if (!openUntil || new Date(openUntil) <= new Date()) return null;
  return openUntil;
}

// ── Sessions ODCAV Départemental ──────────────────────────────────────────────

export async function openOdcavScanSession() {
  await requireRole(["super_admin", "fondateur", "president_odcav"]);
  const adminClient = await createAdminClient();
  const openUntil = new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString();

  const { error } = await adminClient
    .from("scan_sessions")
    .upsert({ scope: "odcav_departemental", open_until: openUntil, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };

  // Uniquement les matchs départementaux
  await (await createAdminClient())
    .from("matches")
    .update({ status: "en_cours" })
    .eq("status", "programme")
    .eq("match_type", "Match Départemental");

  return { success: true, openUntil };
}

export async function closeOdcavScanSession() {
  await requireRole(["super_admin", "fondateur", "president_odcav"]);
  const adminClient = await createAdminClient();
  const { error } = await adminClient
    .from("scan_sessions")
    .upsert({ scope: "odcav_departemental", open_until: null, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };
  return { success: true };
}

export async function getOdcavScanSession(): Promise<string | null> {
  const adminClient = await createAdminClient();
  const { data } = await adminClient
    .from("scan_sessions")
    .select("open_until")
    .eq("scope", "odcav_departemental")
    .maybeSingle();
  const openUntil = data?.open_until || null;
  if (!openUntil || new Date(openUntil) <= new Date()) return null;
  return openUntil;
}

// ── Sessions ODCAV Communal ───────────────────────────────────────────────────

export async function openCommunalScanSession() {
  await requireRole(["super_admin", "fondateur", "president_odcav"]);
  const adminClient = await createAdminClient();
  const openUntil = new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString();

  const { error } = await adminClient
    .from("scan_sessions")
    .upsert({ scope: "odcav_communal", open_until: openUntil, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };

  // Uniquement les matchs communaux
  await (await createAdminClient())
    .from("matches")
    .update({ status: "en_cours" })
    .eq("status", "programme")
    .eq("match_type", "Match Communal");

  return { success: true, openUntil };
}

export async function closeCommunalScanSession() {
  await requireRole(["super_admin", "fondateur", "president_odcav"]);
  const adminClient = await createAdminClient();
  const { error } = await adminClient
    .from("scan_sessions")
    .upsert({ scope: "odcav_communal", open_until: null, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };
  return { success: true };
}

export async function getCommunalScanSession(): Promise<string | null> {
  const adminClient = await createAdminClient();
  const { data } = await adminClient
    .from("scan_sessions")
    .select("open_until")
    .eq("scope", "odcav_communal")
    .maybeSingle();
  const openUntil = data?.open_until || null;
  if (!openUntil || new Date(openUntil) <= new Date()) return null;
  return openUntil;
}

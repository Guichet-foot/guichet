"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export async function openBilleterieSession(zoneId: string) {
  await requireRole(["super_admin", "admin_zone", "fondateur", "president_odcav"]);
  const adminClient = await createAdminClient();
  const openUntil = new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString();
  const { error } = await adminClient
    .from("zones")
    .update({ billeterie_open_until: openUntil })
    .eq("id", zoneId);
  if (error) return { error: error.message };
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

// ── ODCAV inter-match sessions (communaux/départementaux) ─────────────────────

export async function openOdcavScanSession() {
  await requireRole(["super_admin", "fondateur", "president_odcav"]);
  const adminClient = await createAdminClient();
  const openUntil = new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString();
  const { error } = await adminClient
    .from("scan_sessions")
    .upsert({ scope: "odcav", open_until: openUntil, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };
  return { success: true, openUntil };
}

export async function closeOdcavScanSession() {
  await requireRole(["super_admin", "fondateur", "president_odcav"]);
  const adminClient = await createAdminClient();
  const { error } = await adminClient
    .from("scan_sessions")
    .upsert({ scope: "odcav", open_until: null, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };
  return { success: true };
}

export async function getOdcavScanSession(): Promise<string | null> {
  const adminClient = await createAdminClient();
  const { data } = await adminClient
    .from("scan_sessions")
    .select("open_until")
    .eq("scope", "odcav")
    .maybeSingle();
  const openUntil = data?.open_until || null;
  if (!openUntil || new Date(openUntil) <= new Date()) return null;
  return openUntil;
}

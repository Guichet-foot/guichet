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

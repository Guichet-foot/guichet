"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { fetchAll } from "@/lib/supabase/paginate";

export async function createSuperAdmin(formData: {
  email: string;
  fullName: string;
  phone: string;
  role?: "super_admin" | "president_odcav";
}) {
  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return { error: "Non authentifié" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", currentUser.id)
    .single();

  if (profile?.role !== "fondateur") return { error: "Non autorisé" };

  const adminClient = await createAdminClient();

  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let tempPassword = "";
  for (let i = 0; i < 8; i++) {
    tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
    email: formData.email,
    password: tempPassword,
    email_confirm: true,
  });

  if (authError || !authUser.user) return { error: authError?.message || "Erreur" };

  const { error: profileError } = await adminClient.from("profiles").insert({
    id: authUser.user.id,
    full_name: formData.fullName,
    phone: formData.phone || null,
    role: formData.role ?? "super_admin",
    zone_id: null,
    active: true,
    created_by_admin: currentUser.id,
  });

  if (profileError) {
    await adminClient.auth.admin.deleteUser(authUser.user.id);
    return { error: profileError.message };
  }

  revalidatePath("/fondateur/super-admins");
  return { password: tempPassword };
}

export async function toggleSuperAdminActive(userId: string, active: boolean) {
  const adminClient = await createAdminClient();
  const { error } = await adminClient.from("profiles").update({ active }).eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/fondateur/super-admins");
  return { success: true };
}

export async function deleteSuperAdmin(userId: string) {
  const adminClient = await createAdminClient();

  // Nullify all FK references that point to this profile
  await Promise.all([
    adminClient.from("profiles").update({ created_by_admin: null }).eq("created_by_admin", userId),
    adminClient.from("matches").update({ c3_account_id: null }).eq("c3_account_id", userId),
    adminClient.from("billeterie_scans").update({ scanned_by: null }).eq("scanned_by", userId),
    adminClient.from("billeterie_tickets").update({ sold_by: null }).eq("sold_by", userId),
    adminClient.from("tickets").update({ sold_by: null }).eq("sold_by", userId),
    adminClient.from("tickets").update({ scanned_by: null }).eq("scanned_by", userId),
  ]);

  const { error: profileError } = await adminClient.from("profiles").delete().eq("id", userId);
  if (profileError) return { error: profileError.message };

  await adminClient.auth.admin.deleteUser(userId);
  revalidatePath("/fondateur/super-admins");
  return { success: true };
}

export async function updateSuperAdminInfo(userId: string, formData: {
  fullName: string;
  phone: string;
  email: string;
  role?: "super_admin" | "president_odcav";
}) {
  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return { error: "Non authentifié" };

  const { data: caller } = await supabase.from("profiles").select("role").eq("id", currentUser.id).single();
  if (caller?.role !== "fondateur") return { error: "Non autorisé" };

  const adminClient = await createAdminClient();

  const updatePayload: Record<string, unknown> = {
    full_name: formData.fullName,
    phone: formData.phone || null,
  };
  if (formData.role) updatePayload.role = formData.role;

  const { error: profileError } = await adminClient
    .from("profiles")
    .update(updatePayload)
    .eq("id", userId);

  if (profileError) return { error: profileError.message };

  if (formData.email) {
    const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
      email: formData.email,
    });
    if (authError) return { error: authError.message };
  }

  revalidatePath("/fondateur/super-admins");
  return { success: true };
}

export async function resetSuperAdminPassword(userId: string) {
  const adminClient = await createAdminClient();

  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let newPassword = "";
  for (let i = 0; i < 8; i++) {
    newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (error) return { error: error.message };
  return { password: newPassword };
}

// ── createUserForOdcav ────────────────────────────────────────────────────────
// Allows the fondateur to create any sub-account under a specific ODCAV admin.
// The new user's created_by_admin = odcavId so they belong to that ODCAV.
export async function createUserForOdcav(
  odcavId: string,
  formData: {
    email: string;
    fullName: string;
    phone: string;
    role: "admin_zone" | "tresorier" | "c3" | "caissier" | "portier";
    zoneId: string | null;
    isPresident?: boolean;
  }
) {
  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return { error: "Non authentifié" };

  const { data: caller } = await supabase.from("profiles").select("role").eq("id", currentUser.id).single();
  if (caller?.role !== "fondateur") return { error: "Non autorisé" };

  const adminClient = await createAdminClient();

  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let tempPassword = "";
  for (let i = 0; i < 8; i++) tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));

  const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
    email: formData.email,
    password: tempPassword,
    email_confirm: true,
  });

  if (authError || !authUser.user) return { error: authError?.message || "Erreur création compte" };

  const isPresident =
    formData.role === "admin_zone" ? (formData.isPresident ?? false) : false;

  const { error: profileError } = await adminClient.from("profiles").insert({
    id: authUser.user.id,
    full_name: formData.fullName,
    phone: formData.phone || null,
    role: formData.role,
    zone_id: formData.role === "admin_zone" ? formData.zoneId : null,
    active: true,
    is_president: isPresident,
    created_by_admin: odcavId,
  });

  if (profileError) {
    await adminClient.auth.admin.deleteUser(authUser.user.id);
    return { error: profileError.message };
  }

  revalidatePath(`/fondateur/super-admins/${odcavId}`);
  return { password: tempPassword };
}

// ── fondateurToggleUserActive ─────────────────────────────────────────────────
export async function fondateurToggleUserActive(userId: string, active: boolean) {
  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return { error: "Non authentifié" };
  const { data: caller } = await supabase.from("profiles").select("role").eq("id", currentUser.id).single();
  if (caller?.role !== "fondateur") return { error: "Non autorisé" };

  const adminClient = await createAdminClient();
  const { data: target } = await adminClient.from("profiles").select("created_by_admin").eq("id", userId).single();
  if (!target) return { error: "Utilisateur introuvable" };

  const { error } = await adminClient.from("profiles").update({ active }).eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath(`/fondateur/super-admins/${target.created_by_admin}`);
  return { success: true };
}

// ── fondateurDeleteUser ───────────────────────────────────────────────────────
export async function fondateurDeleteUser(userId: string, odcavId: string) {
  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return { error: "Non authentifié" };
  const { data: caller } = await supabase.from("profiles").select("role").eq("id", currentUser.id).single();
  if (caller?.role !== "fondateur") return { error: "Non autorisé" };

  const adminClient = await createAdminClient();

  // Nullify all FK references that point to this profile
  await Promise.all([
    adminClient.from("profiles").update({ created_by_admin: null }).eq("created_by_admin", userId),
    adminClient.from("matches").update({ c3_account_id: null }).eq("c3_account_id", userId),
    adminClient.from("billeterie_scans").update({ scanned_by: null }).eq("scanned_by", userId),
    adminClient.from("billeterie_tickets").update({ sold_by: null }).eq("sold_by", userId),
    adminClient.from("tickets").update({ sold_by: null }).eq("sold_by", userId),
    adminClient.from("tickets").update({ scanned_by: null }).eq("scanned_by", userId),
  ]);

  const { error: profileError } = await adminClient.from("profiles").delete().eq("id", userId);
  if (profileError) return { error: profileError.message };

  await adminClient.auth.admin.deleteUser(userId);
  revalidatePath(`/fondateur/super-admins/${odcavId}`);
  return { success: true };
}

// ── fondateurResetPassword ────────────────────────────────────────────────────
export async function fondateurResetPassword(userId: string) {
  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return { error: "Non authentifié" };
  const { data: caller } = await supabase.from("profiles").select("role").eq("id", currentUser.id).single();
  if (caller?.role !== "fondateur") return { error: "Non autorisé" };

  const adminClient = await createAdminClient();
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let newPassword = "";
  for (let i = 0; i < 8; i++) newPassword += chars.charAt(Math.floor(Math.random() * chars.length));

  const { error } = await adminClient.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) return { error: error.message };
  return { password: newPassword };
}

// ── Fondateur sub-users (assistant_fondateur / billetterie_fondateur) ─────────

function generatePassword(len = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let p = "";
  for (let i = 0; i < len; i++) p += chars.charAt(Math.floor(Math.random() * chars.length));
  return p;
}

export async function createFondateurSubUser(formData: {
  email: string;
  fullName: string;
  phone: string;
  role: "assistant_fondateur" | "billetterie_fondateur";
  permittedModules: string[];
}) {
  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return { error: "Non authentifié" };

  const { data: caller } = await supabase.from("profiles").select("role").eq("id", currentUser.id).single();
  if (caller?.role !== "fondateur") return { error: "Non autorisé" };

  const adminClient = await createAdminClient();
  const tempPassword = generatePassword();

  const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
    email: formData.email,
    password: tempPassword,
    email_confirm: true,
  });

  if (authError || !authUser.user) return { error: authError?.message || "Erreur création compte" };

  const { error: profileError } = await adminClient.from("profiles").insert({
    id: authUser.user.id,
    full_name: formData.fullName,
    phone: formData.phone || null,
    role: formData.role,
    zone_id: null,
    active: true,
    created_by_admin: currentUser.id,
    permitted_modules: formData.permittedModules,
  });

  if (profileError) {
    await adminClient.auth.admin.deleteUser(authUser.user.id);
    return { error: profileError.message };
  }

  revalidatePath("/fondateur/utilisateurs");
  return { password: tempPassword };
}

export async function fondateurSubUserToggleActive(userId: string, active: boolean) {
  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return { error: "Non authentifié" };
  const { data: caller } = await supabase.from("profiles").select("role").eq("id", currentUser.id).single();
  if (caller?.role !== "fondateur") return { error: "Non autorisé" };

  const adminClient = await createAdminClient();
  const { error } = await adminClient.from("profiles").update({ active }).eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/fondateur/utilisateurs");
  return { success: true };
}

export async function fondateurSubUserDelete(userId: string) {
  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return { error: "Non authentifié" };
  const { data: caller } = await supabase.from("profiles").select("role").eq("id", currentUser.id).single();
  if (caller?.role !== "fondateur") return { error: "Non autorisé" };

  const adminClient = await createAdminClient();
  const { data: target } = await adminClient.from("profiles").select("role").eq("id", userId).single();
  if (!target || (target.role !== "assistant_fondateur" && target.role !== "billetterie_fondateur")) {
    return { error: "Utilisateur invalide" };
  }

  await adminClient.from("profiles").delete().eq("id", userId);
  await adminClient.auth.admin.deleteUser(userId);
  revalidatePath("/fondateur/utilisateurs");
  return { success: true };
}

export async function fondateurSubUserResetPassword(userId: string) {
  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return { error: "Non authentifié" };
  const { data: caller } = await supabase.from("profiles").select("role").eq("id", currentUser.id).single();
  if (caller?.role !== "fondateur") return { error: "Non autorisé" };

  const adminClient = await createAdminClient();
  const newPassword = generatePassword();
  const { error } = await adminClient.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) return { error: error.message };
  return { password: newPassword };
}

// ── Maintenance : détection et correction des scans billetterie en double ─────
export async function detectDuplicateBilleterieScans(): Promise<{
  error?: string;
  duplicateTickets?: number;
  extraScans?: number;
}> {
  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return { error: "Non authentifié" };
  const { data: caller } = await supabase.from("profiles").select("role").eq("id", currentUser.id).single();
  if (caller?.role !== "fondateur") return { error: "Non autorisé" };

  const adminClient = await createAdminClient();
  const { data: allScans } = await adminClient
    .from("billeterie_scans")
    .select("id, ticket_id, scanned_at")
    .order("scanned_at", { ascending: true });

  if (!allScans) return { duplicateTickets: 0, extraScans: 0 };

  const byTicket: Record<string, string[]> = {};
  for (const scan of allScans as { id: string; ticket_id: string; scanned_at: string }[]) {
    if (!byTicket[scan.ticket_id]) byTicket[scan.ticket_id] = [];
    byTicket[scan.ticket_id].push(scan.id);
  }

  let duplicateTickets = 0;
  let extraScans = 0;
  for (const scans of Object.values(byTicket)) {
    if (scans.length > 1) { duplicateTickets++; extraScans += scans.length - 1; }
  }

  return { duplicateTickets, extraScans };
}

export async function fixDuplicateBilleterieScans(): Promise<{
  error?: string;
  fixed?: number;
}> {
  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return { error: "Non authentifié" };
  const { data: caller } = await supabase.from("profiles").select("role").eq("id", currentUser.id).single();
  if (caller?.role !== "fondateur") return { error: "Non autorisé" };

  const adminClient = await createAdminClient();
  const { data: allScans } = await adminClient
    .from("billeterie_scans")
    .select("id, ticket_id, scanned_at")
    .order("scanned_at", { ascending: true }); // earliest first

  if (!allScans) return { fixed: 0 };

  // Group by ticket_id (already sorted by scanned_at asc → first entry = earliest scan)
  const firstScanId: Record<string, string> = {};
  const idsToDelete: string[] = [];
  for (const scan of allScans as { id: string; ticket_id: string }[]) {
    if (!firstScanId[scan.ticket_id]) {
      firstScanId[scan.ticket_id] = scan.id; // keep this one
    } else {
      idsToDelete.push(scan.id); // delete all duplicates
    }
  }

  if (idsToDelete.length === 0) return { fixed: 0 };

  const { error } = await adminClient
    .from("billeterie_scans")
    .delete()
    .in("id", idsToDelete);

  if (error) return { error: error.message };
  revalidatePath("/fondateur/parametres");
  return { fixed: idsToDelete.length };
}

// ── Maintenance : numéros de série de billets en double ───────────────────────
// Un bug de génération (comptage lu avant l'insertion, sans atomicité) a permis à
// plusieurs impressions rapprochées de générer le même numéro de série sur des
// billets physiques différents. Le QR code de chaque billet reste unique (le scan
// n'est pas affecté) — seul le numéro imprimé/affiché peut se répéter, ce qui donne
// l'impression de billets "déjà scannés" au personnel qui vérifie à l'œil.
export interface DuplicateSerialGroup {
  serialNumber: string;
  billeterieNames: string[];
  count: number;
}

export async function detectDuplicateBilleterieSerials(): Promise<{
  error?: string;
  groups?: DuplicateSerialGroup[];
  totalDuplicateTickets?: number;
}> {
  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return { error: "Non authentifié" };
  const { data: caller } = await supabase.from("profiles").select("role").eq("id", currentUser.id).single();
  if (caller?.role !== "fondateur") return { error: "Non autorisé" };

  const adminClient = await createAdminClient();
  // Pas de .eq("billeterie_id", ...) : le bug générait le numéro à partir d'un
  // comptage GLOBAL (toutes billetteries confondues), donc un doublon peut très
  // bien exister entre deux billetteries différentes, pas seulement au sein d'une.
  const allTickets = await fetchAll<{ id: string; billeterie_id: string; serial_number: string | null }>(
    (from, to) =>
      adminClient
        .from("billeterie_tickets")
        .select("id, billeterie_id, serial_number")
        .not("serial_number", "is", null)
        .order("id", { ascending: true })
        .range(from, to)
  );

  const byKey: Record<string, Set<string>> = {};
  for (const t of allTickets) {
    const key = t.serial_number as string;
    (byKey[key] ||= new Set()).add(t.billeterie_id);
  }

  const counts: Record<string, number> = {};
  for (const t of allTickets) counts[t.serial_number as string] = (counts[t.serial_number as string] || 0) + 1;

  const dupKeys = Object.keys(counts).filter((k) => counts[k] > 1);
  if (dupKeys.length === 0) return { groups: [], totalDuplicateTickets: 0 };

  const allBilIds = [...new Set(dupKeys.flatMap((k) => [...byKey[k]]))];
  const { data: bils } = await adminClient.from("billeterie").select("id, name").in("id", allBilIds);
  const nameMap = new Map((bils || []).map((b: any) => [b.id as string, b.name as string]));

  const groups: DuplicateSerialGroup[] = dupKeys.map((serialNumber) => ({
    serialNumber,
    billeterieNames: [...byKey[serialNumber]].map((id) => nameMap.get(id) || "Billetterie inconnue"),
    count: counts[serialNumber],
  }));
  groups.sort((a, b) => b.count - a.count);

  const totalDuplicateTickets = dupKeys.reduce((sum, k) => sum + (counts[k] - 1), 0);
  return { groups, totalDuplicateTickets };
}

// Renumérote les billets en double (garde le plus ancien avec son numéro d'origine,
// réattribue un nouveau numéro unique — via la séquence atomique — aux autres).
// N'affecte ni le QR code, ni l'historique de scan : seul le champ serial_number
// change. Les billets déjà imprimés sur papier garderont leur ancien numéro visible —
// cette correction fiabilise les données en base, pas l'étiquette déjà imprimée.
export async function fixDuplicateBilleterieSerials(): Promise<{
  error?: string;
  fixed?: number;
}> {
  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return { error: "Non authentifié" };
  const { data: caller } = await supabase.from("profiles").select("role").eq("id", currentUser.id).single();
  if (caller?.role !== "fondateur") return { error: "Non autorisé" };

  const adminClient = await createAdminClient();
  const allTickets = await fetchAll<{ id: string; billeterie_id: string; serial_number: string | null; created_at: string }>(
    (from, to) =>
      adminClient
        .from("billeterie_tickets")
        .select("id, billeterie_id, serial_number, created_at")
        .not("serial_number", "is", null)
        .order("created_at", { ascending: true })
        .range(from, to)
  );

  // Regroupement global (pas par billetterie) : le bug comptait tous les billets
  // du jour toutes billetteries confondues, un doublon peut donc traverser deux
  // billetteries différentes.
  const byKey: Record<string, typeof allTickets> = {};
  for (const t of allTickets) {
    const key = t.serial_number as string;
    (byKey[key] ||= []).push(t);
  }

  // Pour chaque groupe en double (déjà trié par created_at asc), le premier garde
  // son numéro ; les suivants ont besoin d'un nouveau numéro.
  const toRenumber: { id: string; datePrefix: string }[] = [];
  for (const rows of Object.values(byKey)) {
    if (rows.length <= 1) continue;
    const match = rows[0].serial_number?.match(/^BIL-(\d{8})-\d+$/);
    const datePrefix = match ? match[1] : null;
    for (const t of rows.slice(1)) {
      toRenumber.push({ id: t.id, datePrefix: datePrefix || t.created_at.slice(0, 10).replace(/-/g, "") });
    }
  }

  if (toRenumber.length === 0) return { fixed: 0 };

  const { data: serialRows, error: serialErr } = await adminClient.rpc("reserve_billeterie_serials", {
    n: toRenumber.length,
  });
  if (serialErr || !serialRows) return { error: serialErr?.message || "Erreur génération numéros de série" };
  const serials: number[] = (serialRows as any[]).map((row) =>
    typeof row === "object" && row !== null ? Number(Object.values(row)[0]) : Number(row)
  );

  let fixed = 0;
  for (let i = 0; i < toRenumber.length; i++) {
    const { id, datePrefix } = toRenumber[i];
    const newSerial = `BIL-${datePrefix}-${String(serials[i]).padStart(5, "0")}`;
    const { error } = await adminClient.from("billeterie_tickets").update({ serial_number: newSerial }).eq("id", id);
    if (!error) fixed++;
  }

  revalidatePath("/fondateur/parametres");
  return { fixed };
}

// ── fondateurUpdateSuperAdminModules ──────────────────────────────
export async function fondateurUpdateSuperAdminModules(userId: string, modules: string[]) {
  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return { error: "Non authentifié" };
  const { data: caller } = await supabase.from("profiles").select("role").eq("id", currentUser.id).single();
  if (caller?.role !== "fondateur") return { error: "Non autorisé" };

  const adminClient = await createAdminClient();
  const { data: target } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (!target || !["super_admin", "president_odcav"].includes(target.role)) {
    return { error: "Non autorisé" };
  }

  const { error } = await adminClient
    .from("profiles")
    .update({ permitted_modules: modules.length > 0 ? modules : null })
    .eq("id", userId);

  if (error) return { error: error.message };
  revalidatePath("/fondateur/super-admins");
  return { success: true };
}

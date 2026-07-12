"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { UserRole } from "@/lib/types";

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pw = "";
  for (let i = 0; i < 8; i++) pw += chars.charAt(Math.floor(Math.random() * chars.length));
  return pw;
}

// ── Authorization helper ───────────────────────────────────────────
async function canManage(targetUserId: string): Promise<
  | { error: string }
  | { caller: { id: string; role: string; is_president: boolean } }
> {
  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return { error: "Non authentifié" };

  const { data: caller } = await supabase
    .from("profiles")
    .select("role, is_president")
    .eq("id", currentUser.id)
    .single();

  if (!caller) return { error: "Profil introuvable" };

  const adminClient = await createAdminClient();
  const { data: target } = await adminClient
    .from("profiles")
    .select("role, is_president, created_by_admin")
    .eq("id", targetUserId)
    .single();

  if (!target) return { error: "Utilisateur introuvable" };

  // Président ODCAV can only be managed by fondateur
  if (target.role === "president_odcav" && caller.role !== "fondateur") {
    return { error: "Seul le fondateur peut modifier le compte d'un Président ODCAV" };
  }

  // super_admin and president_odcav may manage anyone below their level
  if (caller.role === "super_admin" || caller.role === "president_odcav") {
    return { caller: { id: currentUser.id, ...caller } };
  }

  // C3 can only manage caissier/portier they themselves created
  if (caller.role === "c3") {
    if (!["caissier", "portier"].includes(target.role)) {
      return { error: "Vous ne pouvez gérer que les caissiers et portiers de votre organisation" };
    }
    if (target.created_by_admin !== currentUser.id) {
      return { error: "Cet utilisateur ne fait pas partie de votre organisation" };
    }
    return { caller: { id: currentUser.id, ...caller } };
  }

  // Nobody below super_admin can touch a Président de zone
  if (target.is_president) {
    return { error: "Vous ne pouvez pas modifier le compte du Président de zone" };
  }

  // A non-président admin_zone cannot modify another admin_zone account
  if (caller.role === "admin_zone" && !caller.is_president && target.role === "admin_zone") {
    return { error: "Vous ne pouvez pas modifier un compte Admin Zone" };
  }

  return { caller: { id: currentUser.id, ...caller } };
}

// ── createUser ────────────────────────────────────────────────────
export async function createUser(formData: {
  email: string;
  fullName: string;
  phone: string;
  role: UserRole;
  zoneId: string | null;
  isPresident?: boolean;
  city?: string | null;
  permittedModules?: string[] | null;
  allowedZones?: string[] | null;
  passwordDurationMinutes?: number | null;
}) {
  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return { error: "Non authentifié" };

  const { data: caller } = await supabase
    .from("profiles")
    .select("role, zone_id, is_president")
    .eq("id", currentUser.id)
    .single();

  if (!caller || !["super_admin", "president_odcav", "admin_zone", "c3"].includes(caller.role)) {
    return { error: "Non autorisé" };
  }

  // ── Rules for super_admin and president_odcav callers ─────────
  if (caller.role === "super_admin" || caller.role === "president_odcav") {
    // Neither can create another president_odcav (only fondateur can)
    if (formData.role === "president_odcav") {
      return { error: "Seul le fondateur peut créer un Président ODCAV" };
    }
  }

  // ── Rules for C3 callers ──────────────────────────────────────
  if (caller.role === "c3") {
    if (!["caissier", "portier"].includes(formData.role)) {
      return { error: "La C3 ne peut créer que des caissiers et portiers" };
    }
    formData.zoneId = null; // C3 caissier/portier have no zone
  }

  // ── Rules for admin_zone callers ──────────────────────────────
  if (caller.role === "admin_zone") {
    if (caller.is_president) {
      if (!["admin_zone", "caissier", "portier"].includes(formData.role)) {
        return { error: "Non autorisé" };
      }
      if (formData.isPresident) {
        return { error: "Seul le Super Admin peut désigner un Président de zone" };
      }
    } else {
      if (!["caissier", "portier"].includes(formData.role)) {
        return { error: "Vous ne pouvez créer que des caissiers et portiers" };
      }
    }
    if (!caller.zone_id) return { error: "Votre zone est introuvable" };
    formData.zoneId = caller.zone_id;
  }

  // Only super_admin/president_odcav may set is_president, and only for admin_zone
  const isPresident =
    (caller.role === "super_admin" || caller.role === "president_odcav") &&
    formData.role === "admin_zone"
      ? (formData.isPresident ?? false)
      : false;

  const adminClient = await createAdminClient();
  const tempPassword = generatePassword();

  const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
    email: formData.email,
    password: tempPassword,
    email_confirm: true,
  });

  if (authError || !authUser.user) {
    return { error: authError?.message || "Erreur lors de la création" };
  }

  const passwordDurationMinutes = formData.passwordDurationMinutes ?? null;
  const passwordExpiresAt = passwordDurationMinutes
    ? new Date(Date.now() + passwordDurationMinutes * 60 * 1000).toISOString()
    : null;

  const { error: profileError } = await adminClient.from("profiles").insert({
    id: authUser.user.id,
    full_name: formData.fullName,
    phone: formData.phone || null,
    role: formData.role,
    zone_id: formData.zoneId,
    active: true,
    is_president: isPresident,
    created_by_admin: currentUser.id,
    city: formData.city || null,
    permitted_modules: formData.permittedModules || null,
    allowed_zones: formData.allowedZones && formData.allowedZones.length > 0 ? formData.allowedZones : null,
    password_duration_minutes: passwordDurationMinutes,
    password_expires_at: passwordExpiresAt,
  });

  if (profileError) {
    await adminClient.auth.admin.deleteUser(authUser.user.id);
    return { error: profileError.message };
  }

  revalidatePath("/utilisateurs");
  return { password: tempPassword };
}

// ── toggleUserActive ──────────────────────────────────────────────
export async function toggleUserActive(userId: string, active: boolean) {
  const check = await canManage(userId);
  if ("error" in check) return { error: check.error };

  const adminClient = await createAdminClient();
  const { error } = await adminClient.from("profiles").update({ active }).eq("id", userId);
  if (error) return { error: error.message };

  revalidatePath("/utilisateurs");
  return { success: true };
}

// ── updateUserInfo ────────────────────────────────────────────────
export async function updateUserInfo(userId: string, formData: {
  fullName: string;
  phone: string;
  role: string;
}) {
  const check = await canManage(userId);
  if ("error" in check) return { error: check.error };

  const adminClient = await createAdminClient();
  const { error } = await adminClient
    .from("profiles")
    .update({ full_name: formData.fullName, phone: formData.phone || null, role: formData.role })
    .eq("id", userId);

  if (error) return { error: error.message };

  revalidatePath("/utilisateurs");
  return { success: true };
}

// ── resetUserPassword ─────────────────────────────────────────────
export async function resetUserPassword(userId: string) {
  const check = await canManage(userId);
  if ("error" in check) return { error: check.error };

  const adminClient = await createAdminClient();
  const newPassword = generatePassword();
  const { error } = await adminClient.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) return { error: error.message };

  // Reset expiration clock from stored duration
  const { data: prof } = await adminClient
    .from("profiles")
    .select("password_duration_minutes")
    .eq("id", userId)
    .single();
  const duration = prof?.password_duration_minutes ?? null;
  const newExpiresAt = duration
    ? new Date(Date.now() + duration * 60 * 1000).toISOString()
    : null;
  await adminClient
    .from("profiles")
    .update({ password_expires_at: newExpiresAt })
    .eq("id", userId);

  return { password: newPassword };
}

// ── updateSelfInfo ────────────────────────────────────────────────
export async function updateSelfInfo(formData: { fullName: string; phone: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: formData.fullName, phone: formData.phone || null })
    .eq("id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/utilisateurs");
  return { success: true };
}

// ── updateUserPermittedModules ────────────────────────────────────
export async function updateUserPermittedModules(userId: string, modules: string[]) {
  const check = await canManage(userId);
  if ("error" in check) return { error: check.error };

  if (check.caller.role !== "president_odcav") {
    return { error: "Non autorisé" };
  }

  const adminClient = await createAdminClient();
  const { data: target } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (!target || target.role !== "super_admin") {
    return { error: "Les modules ne s'appliquent qu'aux comptes Super Admin" };
  }

  const { error } = await adminClient
    .from("profiles")
    .update({ permitted_modules: modules.length > 0 ? modules : null })
    .eq("id", userId);

  if (error) return { error: error.message };
  revalidatePath("/utilisateurs");
  return { success: true };
}

// ── deleteUser ────────────────────────────────────────────────────
export async function deleteUser(userId: string) {
  const check = await canManage(userId);
  if ("error" in check) return { error: check.error };

  const adminClient = await createAdminClient();

  const { error: profileError } = await adminClient.from("profiles").delete().eq("id", userId);
  if (profileError) return { error: profileError.message };

  const { error: authError } = await adminClient.auth.admin.deleteUser(userId);
  if (authError) return { error: authError.message };

  revalidatePath("/utilisateurs");
  return { success: true };
}

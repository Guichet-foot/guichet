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
// Returns the caller's profile and (optionally) the target's profile.
// Returns { error } string if the caller is not allowed to act on the target.
async function canManage(targetUserId: string): Promise<
  | { error: string }
  | { caller: { role: string; is_president: boolean } }
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

  // super_admin may manage anyone
  if (caller.role === "super_admin") return { caller };

  // For all others we need to inspect the target
  const adminClient = await createAdminClient();
  const { data: target } = await adminClient
    .from("profiles")
    .select("role, is_president")
    .eq("id", targetUserId)
    .single();

  if (!target) return { error: "Utilisateur introuvable" };

  // Nobody below super_admin can touch a Président de zone
  if (target.is_president) {
    return { error: "Vous ne pouvez pas modifier le compte du Président de zone" };
  }

  // A non-président admin_zone cannot modify another admin_zone account
  if (caller.role === "admin_zone" && !caller.is_president && target.role === "admin_zone") {
    return { error: "Vous ne pouvez pas modifier un compte Admin Zone" };
  }

  return { caller };
}

// ── createUser ────────────────────────────────────────────────────
export async function createUser(formData: {
  email: string;
  fullName: string;
  phone: string;
  role: UserRole;
  zoneId: string | null;
  isPresident?: boolean;
}) {
  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return { error: "Non authentifié" };

  const { data: caller } = await supabase
    .from("profiles")
    .select("role, zone_id, is_president")
    .eq("id", currentUser.id)
    .single();

  if (!caller || !["super_admin", "admin_zone"].includes(caller.role)) {
    return { error: "Non autorisé" };
  }

  // ── Rules for admin_zone callers ──────────────────────────────
  if (caller.role === "admin_zone") {
    if (caller.is_president) {
      // Président: may create non-président admin_zone, caissier, portier
      if (!["admin_zone", "caissier", "portier"].includes(formData.role)) {
        return { error: "Non autorisé" };
      }
      // Cannot promote another account to président (only super_admin can)
      if (formData.isPresident) {
        return { error: "Seul le Super Admin peut désigner un Président de zone" };
      }
    } else {
      // Regular admin_zone: caissier and portier only
      if (!["caissier", "portier"].includes(formData.role)) {
        return { error: "Vous ne pouvez créer que des caissiers et portiers" };
      }
    }
    if (!caller.zone_id) return { error: "Votre zone est introuvable" };
    formData.zoneId = caller.zone_id; // always force to caller's zone
  }

  // Only super_admin may set is_president, and only for admin_zone
  const isPresident =
    caller.role === "super_admin" && formData.role === "admin_zone"
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

  const { error: profileError } = await adminClient.from("profiles").insert({
    id: authUser.user.id,
    full_name: formData.fullName,
    phone: formData.phone || null,
    role: formData.role,
    zone_id: formData.zoneId,
    active: true,
    is_president: isPresident,
    created_by_admin: currentUser.id,
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

  return { password: newPassword };
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

"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { UserRole } from "@/lib/types";

function generatePassword(): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export async function createUser(formData: {
  email: string;
  fullName: string;
  phone: string;
  role: UserRole;
  zoneId: string | null;
}) {
  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!currentUser) {
    return { error: "Non authentifié" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", currentUser.id)
    .single();

  if (!profile || !["super_admin", "admin_zone"].includes(profile.role)) {
    return { error: "Non autorisé" };
  }

  // admin_zone can only create caissier or admin_zone in their own zone
  if (profile.role === "admin_zone") {
    if (!["caissier", "admin_zone"].includes(formData.role)) {
      return { error: "Vous ne pouvez créer que des caissiers ou admins zone" };
    }
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("zone_id")
      .eq("id", currentUser.id)
      .single();

    if (!currentProfile?.zone_id) {
      return { error: "Votre zone est introuvable" };
    }
    // Force the new user to the admin's zone
    formData.zoneId = currentProfile.zone_id;
  }

  const adminClient = await createAdminClient();
  const tempPassword = generatePassword();

  const { data: authUser, error: authError } =
    await adminClient.auth.admin.createUser({
      email: formData.email,
      password: tempPassword,
      email_confirm: true,
    });

  if (authError || !authUser.user) {
    return { error: authError?.message || "Erreur lors de la création" };
  }

  const { error: profileError } = await adminClient
    .from("profiles")
    .insert({
      id: authUser.user.id,
      full_name: formData.fullName,
      phone: formData.phone || null,
      role: formData.role,
      zone_id: formData.zoneId,
      active: true,
    });

  if (profileError) {
    await adminClient.auth.admin.deleteUser(authUser.user.id);
    return { error: profileError.message };
  }

  revalidatePath("/utilisateurs");
  return { password: tempPassword };
}

export async function toggleUserActive(userId: string, active: boolean) {
  const adminClient = await createAdminClient();

  const { error } = await adminClient
    .from("profiles")
    .update({ active })
    .eq("id", userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/utilisateurs");
  return { success: true };
}

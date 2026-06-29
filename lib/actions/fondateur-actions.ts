"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createSuperAdmin(formData: {
  email: string;
  fullName: string;
  phone: string;
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
    role: "super_admin",
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
  await adminClient.from("profiles").delete().eq("id", userId);
  await adminClient.auth.admin.deleteUser(userId);
  revalidatePath("/fondateur/super-admins");
  return { success: true };
}

export async function updateSuperAdminInfo(userId: string, formData: {
  fullName: string;
  phone: string;
  email: string;
}) {
  const adminClient = await createAdminClient();

  const { error: profileError } = await adminClient
    .from("profiles")
    .update({
      full_name: formData.fullName,
      phone: formData.phone || null,
    })
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

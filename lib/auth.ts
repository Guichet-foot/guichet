import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Profile, UserRole } from "@/lib/types";

export async function getSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, zone:zones!profiles_zone_id_fkey(*)")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return { ...profile, email: user.email } as Profile;
}

export async function requireAuth(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function requireRole(roles: UserRole[]): Promise<Profile> {
  const profile = await requireAuth();
  // president_odcav and tresorier inherit super_admin access
  // assistant_fondateur and billetterie_fondateur inherit fondateur access
  let effectiveRoles = [...roles] as UserRole[];
  if (roles.includes("super_admin")) {
    if (!effectiveRoles.includes("president_odcav")) effectiveRoles.push("president_odcav");
    if (!effectiveRoles.includes("tresorier")) effectiveRoles.push("tresorier");
  }
  if (roles.includes("fondateur")) {
    if (!effectiveRoles.includes("assistant_fondateur")) effectiveRoles.push("assistant_fondateur");
    if (!effectiveRoles.includes("billetterie_fondateur")) effectiveRoles.push("billetterie_fondateur");
  }
  if (!effectiveRoles.includes(profile.role)) {
    if (profile.role === "caissier") redirect("/vente");
    if (profile.role === "portier") redirect("/scanner");
    if (profile.role === "fondateur" || profile.role === "assistant_fondateur" || profile.role === "billetterie_fondateur") redirect("/fondateur/dashboard");
    redirect("/dashboard");
  }
  return profile;
}

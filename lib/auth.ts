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
  if (!roles.includes(profile.role)) {
    redirect(profile.role === "caissier" ? "/vente" : "/dashboard");
  }
  return profile;
}

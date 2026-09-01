import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";

export default async function HomePage() {
  const profile = await getProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role === "fondateur") redirect("/fondateur/dashboard");
  if (profile.role === "caissier") redirect("/vente");
  if (profile.role === "portier") redirect("/scanner");
  if (profile.role === "admin_zone" || profile.role === "c3") redirect("/finances");

  redirect("/dashboard");
}

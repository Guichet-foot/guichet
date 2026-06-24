import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";

export default async function HomePage() {
  const profile = await getProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role === "caissier") {
    redirect("/vente");
  }

  redirect("/dashboard");
}

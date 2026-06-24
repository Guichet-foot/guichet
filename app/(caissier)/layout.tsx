import { requireAuth } from "@/lib/auth";
import { NavCaissier } from "@/components/nav-caissier";

export default async function CaissierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireAuth();

  return (
    <div className="min-h-screen bg-cream">
      <NavCaissier userName={profile.full_name} />
      <main className="pt-16 pb-20 px-4">{children}</main>
    </div>
  );
}

import { requireAuth } from "@/lib/auth";
import { NavCaissier } from "@/components/nav-caissier";
import { BilletterieBanner } from "@/components/billetterie-banner";

export default async function CaissierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireAuth();
  const showBanner = profile.role === "caissier" || profile.role === "portier";

  return (
    <div className="min-h-screen bg-cream">
      <NavCaissier
        userName={profile.full_name}
        userRole={profile.role}
      />
      <main className="pt-16 pb-20 px-4">
        {showBanner && (
          <div className="pt-3">
            <BilletterieBanner canPay={false} />
          </div>
        )}
        {children}
      </main>
    </div>
  );
}

import { requireRole } from "@/lib/auth";
import { SidebarAdmin } from "@/components/sidebar-admin";
import { BilletterieBanner } from "@/components/billetterie-banner";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole(["super_admin", "admin_zone"]);

  return (
    <div className="flex min-h-screen">
      <SidebarAdmin
        userName={profile.full_name}
        userRole={profile.role}
        zoneName={profile.zone?.name}
      />
      <main className="flex-1 min-w-0 overflow-hidden">
        <div className="p-4 pt-16 lg:p-8 lg:pt-8 max-w-full">
          {profile.role === "admin_zone" && <BilletterieBanner canPay={true} />}
          {children}
        </div>
      </main>
    </div>
  );
}

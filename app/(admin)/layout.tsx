import { requireRole } from "@/lib/auth";
import { SidebarAdmin } from "@/components/sidebar-admin";

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
      <main className="flex-1 lg:ml-0">
        <div className="p-4 pt-16 lg:p-8 lg:pt-8">{children}</div>
      </main>
    </div>
  );
}

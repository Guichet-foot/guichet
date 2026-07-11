import { requireRole } from "@/lib/auth";
import { SidebarAdmin } from "@/components/sidebar-admin";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole(["super_admin", "admin_zone", "c3", "fondateur"]);

  return (
    <div className="flex min-h-screen">
      <div className="print:hidden">
        <SidebarAdmin
          userName={profile.full_name}
          userRole={profile.role}
          zoneName={profile.zone?.name}
          permittedModules={profile.permitted_modules}
        />
      </div>
      <main className="flex-1 min-w-0 overflow-hidden print:w-full">
        <div className="p-4 pt-16 lg:p-8 lg:pt-8 max-w-full print:p-6 print:pt-6">
          {children}
        </div>
      </main>
    </div>
  );
}

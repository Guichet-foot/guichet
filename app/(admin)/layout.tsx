import { requireRole } from "@/lib/auth";
import { SidebarAdmin } from "@/components/sidebar-admin";
import { SidebarFondateur } from "@/components/sidebar-fondateur";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole(["super_admin", "admin_zone", "c3", "fondateur", "president_odcav", "tresorier"]);

  // Le fondateur accède à certaines routes admin (ex: /finances/inter) :
  // on lui affiche sa propre sidebar pour qu'il reste dans son contexte.
  const isFondateur = profile.role === "fondateur";

  return (
    <div className="flex min-h-screen">
      <div className="print:hidden">
        {isFondateur ? (
          <SidebarFondateur
            userName={profile.full_name}
            userRole={profile.role}
            permittedModules={profile.permitted_modules ?? null}
          />
        ) : (
          <SidebarAdmin
            userName={profile.full_name}
            userRole={profile.role}
            zoneName={profile.zone?.name}
            permittedModules={profile.permitted_modules}
          />
        )}
      </div>
      <main className="flex-1 min-w-0 overflow-hidden print:w-full">
        <div className="p-4 pt-16 lg:p-8 lg:pt-8 max-w-full print:p-6 print:pt-6">
          {children}
        </div>
      </main>
    </div>
  );
}

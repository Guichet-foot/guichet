import { requireRole } from "@/lib/auth";
import { SidebarFondateur } from "@/components/sidebar-fondateur";

export default async function FondateurLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole(["fondateur"]);

  return (
    <div className="flex min-h-screen bg-cream">
      <SidebarFondateur userName={profile.full_name} />
      <main className="flex-1 min-w-0 overflow-hidden">
        <div className="p-4 pt-16 lg:p-8 lg:pt-8 max-w-full">{children}</div>
      </main>
    </div>
  );
}

"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  Users,
  MapPin,
  Trophy,
  Wallet,
  FileText,
  LogOut,
  Menu,
  X,
  Shield,
  CalendarDays,
  Settings,
  Ticket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import type { UserRole } from "@/lib/types";

interface SidebarProps {
  userName: string;
  userRole: UserRole;
  zoneName?: string;
}

const adminLinks = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/equipes", label: "Équipes", icon: Shield },
  { href: "/programme", label: "Programme", icon: CalendarDays },
  { href: "/billets", label: "Billets", icon: Ticket },
  { href: "/matchs", label: "Matchs", icon: Trophy },
  { href: "/finances", label: "Finances", icon: Wallet },
  { href: "/rapports", label: "Rapports", icon: FileText },
  { href: "/utilisateurs", label: "Utilisateurs", icon: Users },
  { href: "/parametres", label: "Paramètres", icon: Settings },
];

const superAdminLinks = [
  { href: "/zones", label: "Zones", icon: MapPin },
];

export function SidebarAdmin({ userName, userRole, zoneName }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const links =
    userRole === "super_admin"
      ? [...adminLinks, ...superAdminLinks]
      : adminLinks;

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-brand text-white p-2 rounded-lg"
        aria-label="Menu"
      >
        <Menu className="h-6 w-6" />
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-brand text-white transform transition-transform duration-200 lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-white/15 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <Image
                  src="/logo-sidebar.png"
                  alt="Guichet Foot"
                  width={220}
                  height={55}
                  className="h-14 w-auto"
                  priority
                />
                {zoneName && (
                  <p className="text-xs text-white/70 mt-1">{zoneName}</p>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="lg:hidden text-white/70 hover:text-white"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {links.map((link) => {
              const isActive = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <link.icon className="h-5 w-5" />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-white/15 shrink-0">
            <div className="mb-3">
              <p className="text-sm font-medium truncate">{userName}</p>
              <p className="text-xs text-white/60 capitalize">
                {userRole.replace("_", " ")}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Déconnexion
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}

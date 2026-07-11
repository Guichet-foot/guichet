"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
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
  Settings,
  User,
  Building2,
  ContactRound,
  PackageX,
  Network,
  TicketCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import type { UserRole } from "@/lib/types";

interface SidebarProps {
  userName: string;
  userRole: UserRole;
  zoneName?: string;
  permittedModules?: string[] | null;
}

const adminLinks = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/equipes", label: "Équipes", icon: Shield },
  { href: "/matchs", label: "Matchs", icon: Trophy },
  { href: "/finances", label: "Finances", icon: Wallet },
  { href: "/invendus", label: "Invendus", icon: PackageX },
  { href: "/rapports", label: "Rapports", icon: FileText },
  { href: "/utilisateurs", label: "Utilisateurs", icon: Users },
  { href: "/cartes", label: "Cartes d'accès", icon: ContactRound },
  { href: "/parametres", label: "Paramètres Zone", icon: Settings },
];

const superAdminLinks = [
  { href: "/zones", label: "Zones", icon: MapPin },
  { href: "/billeterie", label: "Billetterie", icon: TicketCheck },
  { href: "/parametres-odcav", label: "Paramètre ODCAV", icon: Building2 },
];

// C3 has no zone, no cartes, no Paramètre Zone — their own settings
const c3Links = [
  { href: "/dashboard",      label: "Tableau de bord",  icon: LayoutDashboard },
  { href: "/equipes",        label: "Équipes",           icon: Shield },
  { href: "/matchs",         label: "Matchs",            icon: Trophy },
  { href: "/finances",       label: "Finances",          icon: Wallet },
  { href: "/invendus",       label: "Invendus",          icon: PackageX },
  { href: "/rapports",       label: "Rapports",          icon: FileText },
  { href: "/utilisateurs",   label: "Utilisateurs",      icon: Users },
  { href: "/parametres-c3",  label: "Paramètre C3",      icon: Network },
];

export function SidebarAdmin({ userName, userRole, zoneName, permittedModules }: SidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const baseLinks =
    userRole === "c3"
      ? c3Links
      : userRole === "super_admin" || userRole === "president_odcav" || userRole === "fondateur" || userRole === "tresorier"
      ? [...adminLinks, ...superAdminLinks]
      : adminLinks;

  // Filter by permitted_modules when set (null = all modules visible)
  const links =
    permittedModules && permittedModules.length > 0
      ? baseLinks.filter((l) => {
          const key = l.href.replace(/^\//, "");
          return key === "dashboard" || permittedModules.includes(key);
        })
      : baseLinks;

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <>
      {/* Mobile/Tablet top header bar */}
      <header className="fixed top-0 left-0 right-0 z-40 lg:hidden">
        <div className="mx-3 mt-2 flex items-center justify-between bg-white/80 backdrop-blur-xl border border-brand/10 rounded-2xl px-3 py-2 shadow-sm">
          <div className="flex items-center gap-2">
            <Image
              src="/login-logo.png"
              alt="Guichet Foot"
              width={200}
              height={50}
              className="h-10 sm:h-12 w-auto"
              priority
            />
          </div>
          <div className="flex items-center gap-1">
            {/* Profile button — tablet+ */}
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="hidden sm:flex items-center justify-center w-9 h-9 rounded-xl bg-brand/5 text-brand hover:bg-brand/10 transition-colors"
              aria-label="Profil"
            >
              <User className="h-5 w-5" />
            </button>
            {/* Menu toggle */}
            <button
              onClick={() => setOpen(true)}
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-brand/5 text-brand hover:bg-brand/10 transition-colors"
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Profile dropdown — tablet */}
        {profileOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setProfileOpen(false)} />
            <div className="absolute right-3 top-16 z-40 bg-white rounded-xl shadow-lg border p-4 w-56">
              <div className="mb-3">
                <p className="font-semibold text-sm">{userName}</p>
                <p className="text-xs text-muted-foreground capitalize">{userRole.replace("_", " ")}</p>
                {zoneName && <p className="text-xs text-muted-foreground">{zoneName}</p>}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="w-full justify-start text-danger border-danger"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Déconnexion
              </Button>
            </div>
          </>
        )}
      </header>

      {/* Sidebar overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
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

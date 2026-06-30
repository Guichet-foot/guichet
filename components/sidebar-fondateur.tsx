"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LayoutDashboard, Users, LogOut, Menu, X, CreditCard, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface SidebarFondateurProps {
  userName: string;
}

const links = [
  { href: "/fondateur/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/fondateur/super-admins", label: "Super Admins", icon: Users },
  { href: "/fondateur/abonnements", label: "Abonnements", icon: CreditCard },
  { href: "/fondateur/parametres", label: "Paramètres", icon: Settings2 },
];

export function SidebarFondateur({ userName }: SidebarFondateurProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/fondateur";
  }

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 lg:hidden">
        <div className="mx-3 mt-2 flex items-center justify-between bg-ink/90 backdrop-blur-xl border border-white/10 rounded-2xl px-3 py-2 shadow-lg">
          <Image src="/logo-sidebar.png" alt="Guichet Foot" width={140} height={35} className="h-8 w-auto" priority />
          <button onClick={() => setOpen(true)} className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 text-white" aria-label="Menu">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {open && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-ink text-white transform transition-transform duration-200 lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-white/10 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <Image src="/logo-sidebar.png" alt="Guichet Foot" width={180} height={45} className="h-12 w-auto" priority />
                <p className="text-xs text-amber-400 mt-1 font-semibold">Espace Fondateur</p>
              </div>
              <button onClick={() => setOpen(false)} className="lg:hidden text-white/70 hover:text-white" aria-label="Fermer">
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
                      ? "bg-amber-600/30 text-amber-400"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <link.icon className="h-5 w-5" />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-white/10 shrink-0">
            <div className="mb-3">
              <p className="text-sm font-medium truncate">{userName}</p>
              <p className="text-xs text-amber-400">Fondateur</p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10">
              <LogOut className="h-4 w-4 mr-2" />
              Déconnexion
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}

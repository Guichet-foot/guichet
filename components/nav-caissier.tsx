"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ShoppingCart, ScanLine, List, LogOut } from "lucide-react";

interface NavCaissierProps {
  userName: string;
}

const links = [
  { href: "/vente", label: "Vente", icon: ShoppingCart },
  { href: "/scanner", label: "Scanner", icon: ScanLine },
  { href: "/mes-ventes", label: "Mes ventes", icon: List },
];

export function NavCaissier({ userName }: NavCaissierProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 bg-brand text-white px-4 py-3 flex items-center justify-between">
        <h1 className="font-heading font-bold text-lg">Guichet Foot</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-white/70 hidden sm:block">
            {userName}
          </span>
          <button
            onClick={handleLogout}
            className="text-white/70 hover:text-white"
            aria-label="Déconnexion"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-border">
        <div className="flex justify-around">
          {links.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-col items-center gap-1 py-2 px-4 text-xs font-medium transition-colors ${
                  isActive
                    ? "text-brand"
                    : "text-muted-foreground hover:text-brand"
                }`}
              >
                <link.icon className="h-6 w-6" />
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

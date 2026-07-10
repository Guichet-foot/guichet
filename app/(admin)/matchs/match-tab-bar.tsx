import Link from "next/link";
import { MapPin, Users, Building2 } from "lucide-react";

export function MatchTabBar({ active }: { active: "zonaux" | "communaux" | "departementaux" }) {
  const tabs = [
    { key: "zonaux", label: "Matchs Zonaux", href: "/matchs", icon: MapPin },
    { key: "communaux", label: "Matchs Communal", href: "/matchs/communaux", icon: Users },
    { key: "departementaux", label: "Matchs Départementals", href: "/matchs/departementaux", icon: Building2 },
  ] as const;

  return (
    <div className="flex gap-1 border-b overflow-x-auto">
      {tabs.map(({ key, label, href, icon: Icon }) => (
        <Link
          key={key}
          href={href}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
            active === key
              ? "border-brand text-brand"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon className="h-4 w-4" />
          {label}
        </Link>
      ))}
    </div>
  );
}

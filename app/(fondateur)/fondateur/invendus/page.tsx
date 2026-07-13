import { requireRole } from "@/lib/auth";
import {
  getFinishedMatches,
  getFinishedInterMatches,
  getMatchUnsoldMap,
} from "@/lib/actions/invendus-actions";
import { InvendusList } from "@/app/(admin)/invendus/invendus-list";
import { PackageX, MapPin, Users, Building2 } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Invendus" };

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function FondateurInvendusPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireRole(["fondateur"]);
  const params = await searchParams;

  const activeTab =
    params.tab === "communale"
      ? "communale"
      : params.tab === "departemental"
      ? "departemental"
      : "zonale";

  if (activeTab === "communale") {
    const matches = await getFinishedInterMatches("Match Communal");
    const unsoldMap = await getMatchUnsoldMap(matches.map((m: any) => m.id));
    return (
      <div className="max-w-3xl space-y-6">
        <InvenduTabBar active="communale" />
        <PageHeader
          title="Invendus — Communal"
          subtitle="Billets invendus de tous les matchs communaux"
        />
        <InvendusList matches={matches} unsoldMap={unsoldMap} />
      </div>
    );
  }

  if (activeTab === "departemental") {
    const matches = await getFinishedInterMatches("Match Départemental");
    const unsoldMap = await getMatchUnsoldMap(matches.map((m: any) => m.id));
    return (
      <div className="max-w-3xl space-y-6">
        <InvenduTabBar active="departemental" />
        <PageHeader
          title="Invendus — Départemental"
          subtitle="Billets invendus de tous les matchs départementaux"
        />
        <InvendusList matches={matches} unsoldMap={unsoldMap} />
      </div>
    );
  }

  // Zonale : tous les matchs terminés avec une zone (pas les inter)
  const allMatches = await getFinishedMatches();
  const zonaleMatches = allMatches.filter((m: any) => m.zone !== null);
  const unsoldMap = await getMatchUnsoldMap(zonaleMatches.map((m: any) => m.id));

  return (
    <div className="max-w-3xl space-y-6">
      <InvenduTabBar active="zonale" />
      <PageHeader
        title="Invendus — Zonale"
        subtitle="Gérez les invendus pour tous les matchs de zone"
      />
      <InvendusList matches={zonaleMatches} unsoldMap={unsoldMap} />
    </div>
  );
}

function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
        <PackageX className="h-6 w-6 text-red-600" />
      </div>
      <div>
        <h1 className="text-2xl font-bold font-heading">{title}</h1>
        <p className="text-muted-foreground text-sm">{subtitle}</p>
      </div>
    </div>
  );
}

function InvenduTabBar({
  active,
}: {
  active: "zonale" | "communale" | "departemental";
}) {
  const tabs = [
    { key: "zonale", label: "Zonale", href: "/fondateur/invendus", icon: MapPin },
    { key: "communale", label: "Communale", href: "/fondateur/invendus?tab=communale", icon: Users },
    { key: "departemental", label: "Départemental", href: "/fondateur/invendus?tab=departemental", icon: Building2 },
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

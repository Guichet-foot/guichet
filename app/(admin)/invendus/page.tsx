import { requireRole } from "@/lib/auth";
import { getEffectiveZone } from "@/lib/get-effective-zone";
import {
  getFinishedMatches,
  getFinishedMatchesForZone,
  getFinishedInterMatches,
  getMatchUnsoldMap,
} from "@/lib/actions/invendus-actions";
import { InvendusList } from "./invendus-list";
import { ZoneCardGrid } from "@/components/zone-card-grid";
import { ZoneBackHeader } from "@/components/zone-back-header";
import { PackageX, MapPin, Users, Building2 } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Invendus" };

export default async function InvendusPage({
  searchParams,
}: {
  searchParams: Promise<{ zone?: string; tab?: string }>;
}) {
  const profile = await requireRole(["super_admin", "admin_zone", "c3"]);
  const params = await searchParams;

  const isOdcavRole =
    profile.role === "super_admin" ||
    profile.role === "president_odcav" ||
    profile.role === "tresorier";

  const activeTab = params.tab === "communale"
    ? "communale"
    : params.tab === "departemental"
    ? "departemental"
    : "zonale";

  // ── Onglet Communale ──────────────────────────────────────────
  if (isOdcavRole && activeTab === "communale") {
    const matches = await getFinishedInterMatches("Match Communal");
    const unsoldMap = await getMatchUnsoldMap(matches.map((m: { id: string }) => m.id));
    return (
      <div className="max-w-3xl space-y-6">
        <InvenduTabBar active="communale" />
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
            <PackageX className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading">Invendus — Communaux</h1>
            <p className="text-muted-foreground text-sm">Billets invendus des matchs communaux</p>
          </div>
        </div>
        <InvendusList matches={matches} unsoldMap={unsoldMap} />
      </div>
    );
  }

  // ── Onglet Départemental ──────────────────────────────────────
  if (isOdcavRole && activeTab === "departemental") {
    const matches = await getFinishedInterMatches("Match Départemental");
    const unsoldMap = await getMatchUnsoldMap(matches.map((m: { id: string }) => m.id));
    return (
      <div className="max-w-3xl space-y-6">
        <InvenduTabBar active="departemental" />
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
            <PackageX className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading">Invendus — Départementaux</h1>
            <p className="text-muted-foreground text-sm">Billets invendus des matchs départementaux</p>
          </div>
        </div>
        <InvendusList matches={matches} unsoldMap={unsoldMap} />
      </div>
    );
  }

  // ── Onglet Zonale (default) ────────────────────────────────────

  // president_odcav / tresorier : sélection de zone obligatoire, lecture seule
  if (profile.role === "president_odcav" || profile.role === "tresorier") {
    const { effectiveZoneId, selectedZone, ownedZones, needsZoneSelection } =
      await getEffectiveZone(profile, params.zone);

    if (needsZoneSelection) {
      return (
        <div className="space-y-6">
          {isOdcavRole && <InvenduTabBar active="zonale" />}
          <ZoneCardGrid zones={ownedZones} title="Invendus" />
        </div>
      );
    }

    const matches = await getFinishedMatchesForZone(effectiveZoneId!);
    const unsoldMap = await getMatchUnsoldMap(matches.map((m: { id: string }) => m.id));

    return (
      <div className="max-w-3xl space-y-6">
        <InvenduTabBar active="zonale" />
        <ZoneBackHeader zoneName={selectedZone!.name} />
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
            <PackageX className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading">Invendus</h1>
            <p className="text-muted-foreground text-sm">{selectedZone!.name} — consultation uniquement</p>
          </div>
        </div>
        <InvendusList matches={matches} unsoldMap={unsoldMap} readOnly />
      </div>
    );
  }

  // Flux normal : admin_zone, super_admin, c3
  const matches = await getFinishedMatches();
  const matchIds = matches.map((m: { id: string }) => m.id);
  const unsoldMap = await getMatchUnsoldMap(matchIds);

  return (
    <div className="max-w-3xl space-y-6">
      {isOdcavRole && <InvenduTabBar active="zonale" />}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
          <PackageX className="h-6 w-6 text-red-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading">Invendus</h1>
          <p className="text-muted-foreground text-sm">Déclarez les billets invendus après chaque match</p>
        </div>
      </div>

      <InvendusList matches={matches} unsoldMap={unsoldMap} />
    </div>
  );
}

function InvenduTabBar({ active }: { active: "zonale" | "communale" | "departemental" }) {
  const tabs = [
    { key: "zonale", label: "Zonale", href: "/invendus", icon: MapPin },
    { key: "communale", label: "Communale", href: "/invendus?tab=communale", icon: Users },
    { key: "departemental", label: "Départemental", href: "/invendus?tab=departemental", icon: Building2 },
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

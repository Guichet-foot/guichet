import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { getEffectiveZone } from "@/lib/get-effective-zone";
import { ZoneCardGrid } from "@/components/zone-card-grid";
import { ZoneBackHeader } from "@/components/zone-back-header";
import { RapportsForm } from "./rapports-form";
import { RapportsInterForm } from "./rapports-inter-form";
import Link from "next/link";
import { MapPin, Users, Building2, FileText } from "lucide-react";

export const metadata = { title: "Rapports" };

export default async function RapportsPage({
  searchParams,
}: {
  searchParams: Promise<{ zone?: string; tab?: string }>;
}) {
  const profile = await requireRole(["super_admin", "admin_zone", "c3", "president_odcav", "tresorier"]);
  const params = await searchParams;

  const isOdcavRole = ["super_admin", "president_odcav", "tresorier"].includes(profile.role);

  const activeTab = isOdcavRole
    ? (params.tab === "communale" ? "communale" : params.tab === "departemental" ? "departemental" : "zonale")
    : "zonale";

  // ── Onglet Communale ──────────────────────────────────────────────────────────
  if (isOdcavRole && activeTab === "communale") {
    const adminClient = await createAdminClient();
    // super_admin and president_odcav see all matches (no created_by filter)
    const isGlobalRole = profile.role === "super_admin" || profile.role === "president_odcav";
    const ownerId = (profile.role === "tresorier" && (profile as any).created_by_admin)
      ? (profile as any).created_by_admin as string : profile.id;
    let creatorIds: string[] | null = null;
    if (!isGlobalRole) {
      const { data: subAdmins } = await adminClient.from("profiles").select("id").eq("created_by_admin", ownerId);
      creatorIds = [ownerId, ...((subAdmins || []) as any[]).map((p: any) => p.id as string)];
    }
    let matchesQuery: any = adminClient
      .from("matches")
      .select("id, home_team, away_team, match_date")
      .eq("match_type", "Match Communal")
      .is("zone_id", null)
      .order("match_date", { ascending: false });
    if (creatorIds) matchesQuery = matchesQuery.in("created_by", creatorIds);
    const { data: matches } = await matchesQuery;

    const { data: odcavData } = await adminClient
      .from("odcav_settings")
      .select("nom")
      .eq("id", ownerId)
      .maybeSingle();

    return (
      <div className="max-w-lg mx-auto space-y-6">
        <RapportsTabBar active="communale" />
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center">
            <FileText className="h-6 w-6 text-brand" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading">Rapports PDF</h1>
            <p className="text-muted-foreground text-sm">Matchs Communaux — {odcavData?.nom || "ODCAV"}</p>
          </div>
        </div>
        <RapportsInterForm
          matchType="Match Communal"
          matches={(matches || []) as { id: string; home_team: string; away_team: string; match_date: string }[]}
        />
      </div>
    );
  }

  // ── Onglet Départemental ──────────────────────────────────────────────────────
  if (isOdcavRole && activeTab === "departemental") {
    const adminClient = await createAdminClient();
    const isGlobalRole = profile.role === "super_admin" || profile.role === "president_odcav";
    const ownerId = (profile.role === "tresorier" && (profile as any).created_by_admin)
      ? (profile as any).created_by_admin as string : profile.id;
    let creatorIds: string[] | null = null;
    if (!isGlobalRole) {
      const { data: subAdmins } = await adminClient.from("profiles").select("id").eq("created_by_admin", ownerId);
      creatorIds = [ownerId, ...((subAdmins || []) as any[]).map((p: any) => p.id as string)];
    }
    let matchesQuery: any = adminClient
      .from("matches")
      .select("id, home_team, away_team, match_date")
      .eq("match_type", "Match Départemental")
      .is("zone_id", null)
      .order("match_date", { ascending: false });
    if (creatorIds) matchesQuery = matchesQuery.in("created_by", creatorIds);
    const { data: matches } = await matchesQuery;

    const { data: odcavData } = await adminClient
      .from("odcav_settings")
      .select("nom")
      .eq("id", ownerId)
      .maybeSingle();

    return (
      <div className="max-w-lg mx-auto space-y-6">
        <RapportsTabBar active="departemental" />
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center">
            <FileText className="h-6 w-6 text-brand" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading">Rapports PDF</h1>
            <p className="text-muted-foreground text-sm">Matchs Départementaux — {odcavData?.nom || "ODCAV"}</p>
          </div>
        </div>
        <RapportsInterForm
          matchType="Match Départemental"
          matches={(matches || []) as { id: string; home_team: string; away_team: string; match_date: string }[]}
        />
      </div>
    );
  }

  // ── Onglet Zonale (default) ───────────────────────────────────────────────────
  const { effectiveZoneId, selectedZone, ownedZones, needsZoneSelection, c3AccountId } =
    await getEffectiveZone(profile, params.zone);

  if (needsZoneSelection) {
    return (
      <div className="space-y-6">
        {isOdcavRole && <RapportsTabBar active="zonale" />}
        <ZoneCardGrid zones={ownedZones} title="Rapports" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {isOdcavRole && <RapportsTabBar active="zonale" />}
      {isOdcavRole && selectedZone && <ZoneBackHeader zoneName={selectedZone.name} />}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center">
          <FileText className="h-6 w-6 text-brand" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading">Rapports PDF</h1>
          <p className="text-muted-foreground text-sm">{selectedZone?.name || "Zone"}</p>
        </div>
      </div>
      <RapportsForm zoneId={effectiveZoneId} c3AccountId={c3AccountId} />
    </div>
  );
}

function RapportsTabBar({ active }: { active: "zonale" | "communale" | "departemental" }) {
  const tabs = [
    { key: "zonale", label: "Zonale", href: "/rapports", icon: MapPin },
    { key: "communale", label: "Communale", href: "/rapports?tab=communale", icon: Users },
    { key: "departemental", label: "Départemental", href: "/rapports?tab=departemental", icon: Building2 },
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

import { requireRole } from "@/lib/auth";
import { getEffectiveZone } from "@/lib/get-effective-zone";
import { ZoneCardGrid } from "@/components/zone-card-grid";
import { ZoneBackHeader } from "@/components/zone-back-header";
import { RapportsForm } from "./rapports-form";

export const metadata = { title: "Rapports" };

export default async function RapportsPage({
  searchParams,
}: {
  searchParams: Promise<{ zone?: string }>;
}) {
  const profile = await requireRole(["super_admin", "admin_zone", "c3"]);
  const params = await searchParams;
  const { effectiveZoneId, selectedZone, ownedZones, needsZoneSelection, c3AccountId } =
    await getEffectiveZone(profile, params.zone);

  if (needsZoneSelection) {
    return <ZoneCardGrid zones={ownedZones} title="Rapports" />;
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {profile.role === "super_admin" && selectedZone && <ZoneBackHeader zoneName={selectedZone.name} />}
      <h1 className="text-2xl font-bold font-heading">Rapports PDF</h1>
      <RapportsForm zoneId={effectiveZoneId} c3AccountId={c3AccountId} />
    </div>
  );
}

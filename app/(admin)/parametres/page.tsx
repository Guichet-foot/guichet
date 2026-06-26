import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveZone } from "@/lib/get-effective-zone";
import { ZoneCardGrid } from "@/components/zone-card-grid";
import { ZoneBackHeader } from "@/components/zone-back-header";
import { ZoneSettingsForm } from "./zone-settings-form";

export const metadata = { title: "Paramètres" };

export default async function ParametresPage({
  searchParams,
}: {
  searchParams: Promise<{ zone?: string }>;
}) {
  const profile = await requireRole(["super_admin", "admin_zone"]);
  const params = await searchParams;
  const { effectiveZoneId, selectedZone, ownedZones, needsZoneSelection } =
    await getEffectiveZone(profile, params.zone);

  if (needsZoneSelection) {
    return <ZoneCardGrid zones={ownedZones} title="Paramètres" />;
  }

  if (!effectiveZoneId) {
    return <p className="text-muted-foreground">Zone introuvable</p>;
  }

  const supabase = await createClient();
  const { data: zone } = await supabase
    .from("zones")
    .select("*")
    .eq("id", effectiveZoneId)
    .single();

  if (!zone) {
    return <p className="text-muted-foreground">Zone introuvable</p>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {profile.role === "super_admin" && selectedZone && <ZoneBackHeader zoneName={selectedZone.name} />}
      <h1 className="text-2xl font-bold font-heading">Paramètres de la zone</h1>
      <ZoneSettingsForm
        zoneId={zone.id}
        initialData={{
          name: zone.name || "",
          region: zone.region || "",
          logo: zone.logo || "",
          president: zone.president || "",
          members: zone.members || [],
          odcav: zone.odcav || "",
          oncav: zone.oncav || "",
        }}
      />
    </div>
  );
}

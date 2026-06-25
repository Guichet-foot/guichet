import { createClient } from "@/lib/supabase/server";
import type { Profile, Zone } from "@/lib/types";

export async function getEffectiveZone(
  profile: Profile,
  zoneParam?: string
): Promise<{
  effectiveZoneId: string | null;
  selectedZone: Zone | null;
  ownedZones: Zone[];
  needsZoneSelection: boolean;
}> {
  if (profile.role === "admin_zone") {
    return {
      effectiveZoneId: profile.zone_id,
      selectedZone: profile.zone || null,
      ownedZones: [],
      needsZoneSelection: false,
    };
  }

  const supabase = await createClient();

  const { data: zones } = await supabase
    .from("zones")
    .select("*")
    .eq("created_by", profile.id)
    .order("name");

  const ownedZones = (zones || []) as Zone[];

  if (zoneParam) {
    const selected = ownedZones.find((z) => z.id === zoneParam);
    if (selected) {
      return {
        effectiveZoneId: selected.id,
        selectedZone: selected,
        ownedZones,
        needsZoneSelection: false,
      };
    }
  }

  return {
    effectiveZoneId: null,
    selectedZone: null,
    ownedZones,
    needsZoneSelection: true,
  };
}

import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Profile, Zone } from "@/lib/types";

export interface EffectiveZone {
  effectiveZoneId: string | null;
  selectedZone: Zone | null;
  ownedZones: Zone[];
  needsZoneSelection: boolean;
  /** Non-null only for C3 users — identifies their own C3 account */
  c3AccountId: string | null;
  /** Zone IDs affiliated to this C3 account (empty for non-C3) */
  c3ZoneIds: string[];
}

export async function getEffectiveZone(
  profile: Profile,
  zoneParam?: string
): Promise<EffectiveZone> {
  // C3 has no zone — they directly own their matches/content
  if (profile.role === "c3") {
    return {
      effectiveZoneId: null,
      selectedZone: null,
      ownedZones: [],
      needsZoneSelection: false,
      c3AccountId: profile.id,
      c3ZoneIds: (profile as any).c3_zone_ids || [],
    };
  }

  if (profile.role === "admin_zone") {
    return {
      effectiveZoneId: profile.zone_id,
      selectedZone: profile.zone || null,
      ownedZones: [],
      needsZoneSelection: false,
      c3AccountId: null,
      c3ZoneIds: [],
    };
  }

  const adminClient = await createAdminClient();
  const supabase = await createClient();

  // super_admin and president_odcav see ALL zones (shared pool — no created_by filter)
  // tresorier is scoped to their parent admin's zones
  const isGlobalRole = profile.role === "fondateur" || profile.role === "super_admin" || profile.role === "president_odcav";
  const ownerIds = [...new Set(
    [profile.id, profile.created_by_admin].filter(Boolean) as string[]
  )];
  const zonesQuery = isGlobalRole
    ? adminClient.from("zones").select("*").order("name")
    : profile.role === "tresorier"
    ? adminClient.from("zones").select("*").in("created_by", ownerIds).order("name")
    : supabase.from("zones").select("*").eq("created_by", profile.id).order("name");

  const { data: zones } = await zonesQuery;
  const ownedZones = (zones || []) as Zone[];

  if (zoneParam) {
    const selected = ownedZones.find((z) => z.id === zoneParam);
    if (selected) {
      return {
        effectiveZoneId: selected.id,
        selectedZone: selected,
        ownedZones,
        needsZoneSelection: false,
        c3AccountId: null,
        c3ZoneIds: [],
      };
    }
  }

  return {
    effectiveZoneId: null,
    selectedZone: null,
    ownedZones,
    needsZoneSelection: true,
    c3AccountId: null,
    c3ZoneIds: [],
  };
}

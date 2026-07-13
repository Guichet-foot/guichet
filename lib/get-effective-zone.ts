import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Profile, Zone } from "@/lib/types";

export interface EffectiveZone {
  effectiveZoneId: string | null;
  selectedZone: Zone | null;
  ownedZones: Zone[];
  needsZoneSelection: boolean;
  /** Non-null only for C3 users — identifies their own C3 account */
  c3AccountId: string | null;
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
    };
  }

  if (profile.role === "admin_zone") {
    return {
      effectiveZoneId: profile.zone_id,
      selectedZone: profile.zone || null,
      ownedZones: [],
      needsZoneSelection: false,
      c3AccountId: null,
    };
  }

  // Use admin client for ODCAV roles to bypass RLS (president_odcav would be blocked
  // by policies that only list 'super_admin'). Data isolation is enforced by the
  // created_by filter at the app level.
  const adminClient = await createAdminClient();
  const supabase = await createClient();

  // Include both the account's own ID and its parent (created_by_admin) to handle
  // zones created before the current hierarchy: some were stored with created_by = parent.id
  const isOdcavRole = profile.role === "super_admin" || profile.role === "president_odcav";
  const ownerIds = [...new Set(
    [profile.id, profile.created_by_admin].filter(Boolean) as string[]
  )];
  const zonesQuery = profile.role === "fondateur"
    ? supabase.from("zones").select("*").order("name")
    : isOdcavRole || profile.role === "tresorier"
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
      };
    }
  }

  return {
    effectiveZoneId: null,
    selectedZone: null,
    ownedZones,
    needsZoneSelection: true,
    c3AccountId: null,
  };
}

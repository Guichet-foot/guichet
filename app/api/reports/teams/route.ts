import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { TeamsReport, type ZoneSection, type TeamRow } from "@/lib/pdf/teams-report";
import React from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

function parseColors(raw: string | null): { official: [string, string] | null; sub: [string, string] | null } {
  if (!raw) return { official: null, sub: null };
  try {
    const p = JSON.parse(raw);
    const off = p.official || [];
    const sub = p.substitute || [];
    return {
      official: off.length >= 2 ? [off[0], off[1]] : null,
      sub: sub.length >= 2 ? [sub[0], sub[1]] : null,
    };
  } catch {
    return { official: null, sub: null };
  }
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, zone_id, created_by_admin, allowed_zones")
    .eq("id", user.id)
    .single();

  const allowedRoles = ["super_admin", "president_odcav", "tresorier", "admin_zone", "c3", "fondateur", "assistant_fondateur", "billetterie_fondateur"];
  if (!profile || !allowedRoles.includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminClient = await createAdminClient();

  // Fetch all zones
  const { data: zonesData } = await adminClient.from("zones").select("id, name").order("name");
  const allZones: { id: string; name: string }[] = zonesData || [];

  // Build zone filter depending on role
  let zoneIds: string[] | null = null;
  if (profile.role === "admin_zone" && profile.zone_id) {
    zoneIds = [profile.zone_id];
  } else if (profile.role === "c3" && profile.allowed_zones?.length) {
    zoneIds = profile.allowed_zones;
  } else if (profile.role === "tresorier" && profile.created_by_admin) {
    // Get zones managed by this ODCAV
    const { data: subAdmins } = await adminClient
      .from("profiles")
      .select("zone_id")
      .eq("created_by_admin", profile.created_by_admin)
      .not("zone_id", "is", null);
    zoneIds = (subAdmins || []).map((p: any) => p.zone_id as string).filter(Boolean);
  } else if (["super_admin", "president_odcav"].includes(profile.role)) {
    // Get zones owned by this ODCAV
    const ownerId = profile.created_by_admin || user.id;
    const { data: subAdmins } = await adminClient
      .from("profiles")
      .select("zone_id")
      .eq("created_by_admin", ownerId)
      .not("zone_id", "is", null);
    zoneIds = (subAdmins || []).map((p: any) => p.zone_id as string).filter(Boolean);
  }
  // fondateur / assistant / billetterie: see all zones (zoneIds = null)

  const filteredZones = zoneIds
    ? allZones.filter((z) => zoneIds!.includes(z.id))
    : allZones;

  // Fetch all teams
  let teamsQuery = adminClient.from("teams").select("*").order("name");
  if (zoneIds?.length) {
    teamsQuery = teamsQuery.in("zone_id", zoneIds);
  }
  const { data: teamsData } = await teamsQuery;
  const allTeams: any[] = teamsData || [];

  // Build zones sections
  const sections: ZoneSection[] = filteredZones
    .map((zone) => {
      const zoneTeams: TeamRow[] = allTeams
        .filter((t) => t.zone_id === zone.id)
        .map((t) => {
          const { official, sub } = parseColors(t.colors);
          return {
            name: t.name,
            president: t.president || null,
            delegates: t.delegates || [],
            colorsOfficial: official,
            colorsSub: sub,
          };
        });
      return { zoneName: zone.name, teams: zoneTeams };
    })
    .filter((s) => s.teams.length > 0);

  const totalTeams = allTeams.length;

  const generatedAt = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const buffer = await renderToBuffer(
    React.createElement(TeamsReport, { zones: sections, generatedAt, totalTeams }) as any
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="equipes-navetane-${new Date().toISOString().split("T")[0]}.pdf"`,
    },
  });
}

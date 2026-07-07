import { requireRole } from "@/lib/auth";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { CardForm } from "./card-form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Nouvelle carte d'accès" };

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function NouvelleCartePage({
  searchParams,
}: {
  searchParams: Promise<{ zone?: string }>;
}) {
  const profile = await requireRole(["super_admin", "admin_zone"]);
  const params = await searchParams;
  const supabase = await createClient();
  const adminClient = await createAdminClient();

  const isOdcavRole = profile.role === "super_admin" || profile.role === "president_odcav";

  let zones: { id: string; name: string }[] = [];
  let defaultZoneId = "";
  let defaultZoneName = "";
  let teams: { id: string; name: string }[] = [];

  if (isOdcavRole) {
    // Load zones owned by this ODCAV user
    const { data } = await adminClient
      .from("zones")
      .select("id, name")
      .eq("created_by", profile.id)
      .order("name");
    zones = (data || []) as { id: string; name: string }[];

    // If a zone was pre-selected from the cartes list page, load its teams
    if (params.zone) {
      const found = zones.find((z) => z.id === params.zone);
      if (found) {
        defaultZoneId = found.id;
        defaultZoneName = found.name;
        const { data: teamsData } = await adminClient
          .from("teams")
          .select("id, name")
          .eq("zone_id", defaultZoneId)
          .order("name");
        teams = (teamsData || []) as { id: string; name: string }[];
      }
    }
  } else {
    // admin_zone: their own zone
    const { data: prof } = await supabase
      .from("profiles")
      .select("zone_id, zone:zones!profiles_zone_id_fkey(name)")
      .eq("id", profile.id)
      .single();

    if (prof?.zone_id) {
      defaultZoneId = prof.zone_id;
      defaultZoneName = (prof as any).zone?.name || "";
      zones = [{ id: defaultZoneId, name: defaultZoneName }];

      const { data: teamsData } = await adminClient
        .from("teams")
        .select("id, name")
        .eq("zone_id", defaultZoneId)
        .order("name");
      teams = (teamsData || []) as { id: string; name: string }[];
    }
  }

  // Back link: return to zone-specific cartes list for ODCAV, or generic list
  const backHref = isOdcavRole && defaultZoneId
    ? `/cartes?zone=${defaultZoneId}`
    : "/cartes";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={backHref}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />Retour
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold font-heading">Nouvelle carte d&apos;accès</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Créez une carte d&apos;identification pour un membre de zone
          </p>
        </div>
      </div>
      <CardForm
        zones={zones}
        defaultZoneId={defaultZoneId}
        defaultZoneName={defaultZoneName}
        isSuperAdmin={isOdcavRole}
        initialTeams={teams}
      />
    </div>
  );
}

import { requireRole } from "@/lib/auth";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { CardForm } from "./card-form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Nouvelle carte d'accès" };

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function NouvelleCartePage() {
  const profile = await requireRole(["super_admin", "admin_zone"]);
  const supabase = await createClient();
  const adminClient = await createAdminClient();

  const isSuperAdmin = profile.role === "super_admin";

  // Zones list
  let zones: { id: string; name: string }[] = [];
  let defaultZoneId = "";
  let defaultZoneName = "";
  let teams: { id: string; name: string }[] = [];

  if (isSuperAdmin) {
    const { data } = await adminClient.from("zones").select("id, name").order("name");
    zones = (data || []) as { id: string; name: string }[];
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/cartes">
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
        isSuperAdmin={isSuperAdmin}
        initialTeams={teams}
      />
    </div>
  );
}

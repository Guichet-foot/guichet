import { requireRole } from "@/lib/auth";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getAccessCard } from "@/lib/actions/carte-actions";
import { notFound } from "next/navigation";
import { CardEditForm } from "./card-edit-form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Modifier la carte" };

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function EditCartePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireRole(["super_admin", "admin_zone"]);
  const supabase = await createClient();
  const adminClient = await createAdminClient();

  const card = await getAccessCard(id);
  if (!card) notFound();

  const isSuperAdmin = profile.role === "super_admin";

  let zones: { id: string; name: string }[] = [];
  let teams: { id: string; name: string }[] = [];

  if (isSuperAdmin) {
    const { data } = await adminClient.from("zones").select("id, name").order("name");
    zones = (data || []) as { id: string; name: string }[];
  } else {
    const { data: prof } = await supabase
      .from("profiles")
      .select("zone_id, zone:zones!profiles_zone_id_fkey(name)")
      .eq("id", profile.id)
      .single();

    if (prof?.zone_id) {
      zones = [{ id: prof.zone_id, name: (prof as any).zone?.name || "" }];
      const { data: teamsData } = await adminClient
        .from("teams")
        .select("id, name")
        .eq("zone_id", prof.zone_id)
        .order("name");
      teams = (teamsData || []) as { id: string; name: string }[];
    }
  }

  // Load teams for the card's zone
  if (isSuperAdmin && card.zone_id) {
    const { data: teamsData } = await adminClient
      .from("teams")
      .select("id, name")
      .eq("zone_id", card.zone_id)
      .order("name");
    teams = (teamsData || []) as { id: string; name: string }[];
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
          <h1 className="text-2xl font-bold font-heading">Modifier la carte</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {card.full_name}
          </p>
        </div>
      </div>

      <CardEditForm
        card={card}
        zones={zones}
        isSuperAdmin={isSuperAdmin}
        initialTeams={teams}
      />
    </div>
  );
}

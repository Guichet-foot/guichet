import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { NouveauMatchForm } from "./nouveau-match-form";

export const metadata = { title: "Nouveau match — Fondateur" };

export default async function FondateurNouveauMatchPage({
  params,
}: {
  params: Promise<{ zoneId: string }>;
}) {
  await requireRole(["fondateur"]);
  const { zoneId } = await params;
  const adminClient = await createAdminClient();

  const { data: zone } = await adminClient
    .from("zones")
    .select("id, name")
    .eq("id", zoneId)
    .single();

  if (!zone) notFound();

  const { data: teamsData } = await adminClient
    .from("teams")
    .select("id, name")
    .eq("zone_id", zoneId)
    .order("name");

  const teams = (teamsData || []) as { id: string; name: string }[];

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/fondateur/matchs/${zoneId}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold font-heading">Nouveau match</h1>
          <p className="text-muted-foreground text-sm">{zone.name}</p>
        </div>
      </div>

      <NouveauMatchForm zoneId={zoneId} zoneName={zone.name} teams={teams} />
    </div>
  );
}

import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { MatchEditForm } from "./match-edit-form";

export default async function MatchModifierPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ zone?: string }>;
}) {
  const profile = await requireRole(["super_admin", "admin_zone", "c3", "fondateur"]);
  const { id } = await params;
  const { zone } = await searchParams;

  const adminClient = await createAdminClient();
  const { data: match } = await adminClient
    .from("matches")
    .select("id, home_team, away_team, venue, match_date, notes, match_type, zone_id")
    .eq("id", id)
    .single();

  if (!match) notFound();

  // Format datetime-local value (YYYY-MM-DDTHH:mm)
  const matchDateLocal = match.match_date
    ? new Date(match.match_date).toISOString().slice(0, 16)
    : "";

  const isFondateur = profile.role === "fondateur";

  // Retourner vers l'onglet d'origine selon le type du match
  let backUrl: string;
  if (match.match_type === "Match Départemental") {
    backUrl = isFondateur ? "/fondateur/matchs/departementaux" : "/matchs/departementaux";
  } else if (match.match_type === "Match Communal") {
    backUrl = isFondateur ? "/fondateur/matchs/communaux" : "/matchs/communaux";
  } else {
    const zoneId = zone || match.zone_id;
    backUrl = zoneId ? `/matchs?zone=${zoneId}` : "/matchs";
  }

  return (
    <MatchEditForm
      matchId={id}
      initialData={{
        homeTeam: match.home_team,
        awayTeam: match.away_team,
        venue: match.venue || "",
        matchDate: matchDateLocal,
        notes: match.notes || "",
      }}
      backUrl={backUrl}
    />
  );
}

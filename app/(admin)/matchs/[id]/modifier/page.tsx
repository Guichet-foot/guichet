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
  await requireRole(["super_admin", "admin_zone", "c3", "fondateur"]);
  const { id } = await params;
  const { zone } = await searchParams;

  const adminClient = await createAdminClient();
  const { data: match } = await adminClient
    .from("matches")
    .select("id, home_team, away_team, venue, match_date, notes")
    .eq("id", id)
    .single();

  if (!match) notFound();

  // Format datetime-local value (YYYY-MM-DDTHH:mm)
  const matchDateLocal = match.match_date
    ? new Date(match.match_date).toISOString().slice(0, 16)
    : "";

  const backUrl = zone ? `/matchs/${id}?zone=${zone}` : `/matchs/${id}`;

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

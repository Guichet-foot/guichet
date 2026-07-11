import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Pencil } from "lucide-react";
import {
  MATCH_STATUS_LABELS,
  MATCH_STATUS_COLORS,
} from "@/lib/constants";
import { formatDateShort, formatFCFA } from "@/lib/format";
import { MatchStatusSelect } from "./match-status-select";

export default async function MatchDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ zone?: string }>;
}) {
  const { id } = await params;
  const { zone } = await searchParams;
  const profile = await requireRole(["super_admin", "admin_zone", "c3", "fondateur"]);

  const adminClient = await createAdminClient();

  const { data: match } = await adminClient
    .from("matches")
    .select("*")
    .eq("id", id)
    .single();

  if (!match) notFound();

  const { data: tickets } = await adminClient
    .from("tickets")
    .select("price, counts_as_revenue")
    .eq("match_id", id)
    .neq("status", "annule");

  let totalRevenue = 0;
  let totalSold = 0;

  tickets?.forEach((t) => {
    if (t.counts_as_revenue) {
      totalRevenue += t.price;
      totalSold++;
    }
  });

  const backUrl = zone ? `/matchs?zone=${zone}` : "/matchs";
  const editUrl = zone ? `/matchs/${id}/modifier?zone=${zone}` : `/matchs/${id}/modifier`;
  const canEdit = profile.role !== "fondateur";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={backUrl}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Matchs
          </Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading">
            {match.home_team} vs {match.away_team}
          </h1>
          <p className="text-muted-foreground">
            {formatDateShort(match.match_date)} — {match.venue}
          </p>
          {match.notes && (
            <p className="text-sm text-muted-foreground mt-1">
              {match.notes}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="secondary"
            className={MATCH_STATUS_COLORS[match.status]}
          >
            {MATCH_STATUS_LABELS[match.status]}
          </Badge>
          {canEdit && match.status !== "termine" && match.status !== "annule" && (
            <Link href={editUrl}>
              <Button variant="outline" size="sm">
                <Pencil className="h-4 w-4 mr-1" />
                Modifier
              </Button>
            </Link>
          )}
          {(profile.role === "super_admin" || profile.role === "admin_zone") && (
            <MatchStatusSelect matchId={match.id} currentStatus={match.status} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Billets vendus</p>
            <p className="text-2xl font-bold">{totalSold}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Recettes</p>
            <p className="text-2xl font-bold text-brand">
              {formatFCFA(totalRevenue)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

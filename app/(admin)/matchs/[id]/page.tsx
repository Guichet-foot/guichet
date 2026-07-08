import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Pencil, Settings, Ticket } from "lucide-react";
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

  const { data: categories } = await adminClient
    .from("ticket_categories")
    .select("*")
    .eq("match_id", id)
    .order("display_order");

  const { data: tickets } = await adminClient
    .from("tickets")
    .select("category_id, price, status, counts_as_revenue")
    .eq("match_id", id)
    .neq("status", "annule");

  const catStats: Record<string, number> = {};
  let totalRevenue = 0;
  let totalSold = 0;

  tickets?.forEach((t) => {
    catStats[t.category_id] = (catStats[t.category_id] || 0) + 1;
    if (t.counts_as_revenue) {
      totalRevenue += t.price;
      totalSold++;
    }
  });

  const backUrl = zone ? `/matchs?zone=${zone}` : "/matchs";
  const editUrl = zone ? `/matchs/${id}/modifier?zone=${zone}` : `/matchs/${id}/modifier`;
  const billetsUrl = zone ? `/matchs/${id}/billets?zone=${zone}` : `/matchs/${id}/billets`;

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
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Catégories</p>
            <p className="text-2xl font-bold">{categories?.length || 0}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold font-heading">Catégories de billets</h2>
        {canEdit && (
          <Link href={billetsUrl}>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Configurer
            </Button>
          </Link>
        )}
      </div>

      {categories && categories.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => {
            const sold = catStats[cat.id] || 0;
            return (
              <Card key={cat.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">{cat.name}</span>
                    <span className="font-bold text-brand">
                      {formatFCFA(cat.price)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {sold} vendus
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Ticket className="h-8 w-8 mx-auto mb-2" />
            <p>Aucune catégorie de billets configurée</p>
            {canEdit && (
              <Link href={billetsUrl}>
                <Button variant="outline" size="sm" className="mt-4">
                  Configurer les billets
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

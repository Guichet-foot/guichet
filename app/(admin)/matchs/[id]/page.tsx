import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Settings, Ticket } from "lucide-react";
import {
  MATCH_STATUS_LABELS,
  MATCH_STATUS_COLORS,
} from "@/lib/constants";
import { formatDateShort, formatFCFA } from "@/lib/format";
import { MatchStatusSelect } from "./match-status-select";

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole(["super_admin", "admin_zone"]);
  const supabase = await createClient();

  const { data: match } = await supabase
    .from("matches")
    .select("*")
    .eq("id", id)
    .single();

  if (!match) notFound();

  const { data: categories } = await supabase
    .from("ticket_categories")
    .select("*")
    .eq("match_id", id)
    .order("display_order");

  const { data: tickets } = await supabase
    .from("tickets")
    .select("category_id, price, status")
    .eq("match_id", id)
    .neq("status", "annule");

  const catStats: Record<string, number> = {};
  let totalRevenue = 0;
  let totalSold = 0;

  tickets?.forEach((t) => {
    catStats[t.category_id] = (catStats[t.category_id] || 0) + 1;
    totalRevenue += t.price;
    totalSold++;
  });

  const totalCapacity =
    categories?.reduce((sum, c) => sum + c.quantity_total, 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/matchs">
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
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className={MATCH_STATUS_COLORS[match.status]}
          >
            {MATCH_STATUS_LABELS[match.status]}
          </Badge>
          <MatchStatusSelect matchId={match.id} currentStatus={match.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Billets vendus</p>
            <p className="text-2xl font-bold">
              {totalSold} / {totalCapacity}
            </p>
            <Progress
              value={totalCapacity > 0 ? (totalSold / totalCapacity) * 100 : 0}
              className="mt-2"
            />
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
        <Link href={`/matchs/${id}/billets`}>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Configurer
          </Button>
        </Link>
      </div>

      {categories && categories.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => {
            const sold = catStats[cat.id] || 0;
            return (
              <Card key={cat.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">{cat.name}</span>
                    <span className="font-bold text-brand">
                      {formatFCFA(cat.price)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {sold} / {cat.quantity_total} vendus
                  </p>
                  <Progress
                    value={
                      cat.quantity_total > 0
                        ? (sold / cat.quantity_total) * 100
                        : 0
                    }
                  />
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
            <Link href={`/matchs/${id}/billets`}>
              <Button variant="outline" size="sm" className="mt-4">
                Configurer les billets
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

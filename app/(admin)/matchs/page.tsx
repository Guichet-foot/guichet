import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trophy, Eye } from "lucide-react";
import { MATCH_STATUS_LABELS, MATCH_STATUS_COLORS } from "@/lib/constants";
import { formatDateShort, formatFCFA } from "@/lib/format";
import { MatchActionButtons } from "./match-action-buttons";

export const metadata = { title: "Matchs" };

export default async function MatchsPage() {
  const profile = await requireRole(["super_admin", "admin_zone"]);
  const supabase = await createClient();

  let query = supabase
    .from("matches")
    .select("*")
    .order("match_date", { ascending: false });

  if (profile.role === "admin_zone") {
    query = query.eq("zone_id", profile.zone_id!);
  }

  const { data: matches } = await query;

  const matchIds = matches?.map((m) => m.id) || [];
  let ticketStats: Record<string, { count: number; revenue: number }> = {};

  if (matchIds.length > 0) {
    const { data: tickets } = await supabase
      .from("tickets")
      .select("match_id, price")
      .in("match_id", matchIds)
      .neq("status", "annule");

    if (tickets) {
      ticketStats = tickets.reduce(
        (acc, t) => {
          if (!acc[t.match_id]) acc[t.match_id] = { count: 0, revenue: 0 };
          acc[t.match_id].count++;
          acc[t.match_id].revenue += t.price;
          return acc;
        },
        {} as Record<string, { count: number; revenue: number }>
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Matchs</h1>
          <p className="text-muted-foreground">
            {matches?.length || 0} match(s)
          </p>
        </div>
        <Link href="/matchs/nouveau">
          <Button className="bg-brand hover:bg-brand/90">
            <Plus className="h-4 w-4 mr-2" />
            Nouveau match
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          {!matches || matches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Trophy className="h-12 w-12 mb-4" />
              <p>Aucun match programmé</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Match</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="hidden sm:table-cell">Vente</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Billets</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Recettes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map((match: any) => {
                  const stats = ticketStats[match.id] || { count: 0, revenue: 0 };
                  return (
                    <TableRow key={match.id}>
                      <TableCell className="font-medium">
                        {match.home_team} vs {match.away_team}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">
                        {formatDateShort(match.match_date)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={MATCH_STATUS_COLORS[match.status]}
                        >
                          {MATCH_STATUS_LABELS[match.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {match.status === "termine" || match.status === "annule" ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <Badge
                            variant="secondary"
                            className={
                              match.vente_active
                                ? "bg-green-100 text-green-800"
                                : "bg-orange-100 text-orange-800"
                            }
                          >
                            {match.vente_active ? "Ouverte" : "Fermée"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-right">
                        {stats.count}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-right">
                        {formatFCFA(stats.revenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <MatchActionButtons
                            matchId={match.id}
                            status={match.status}
                            venteActive={match.vente_active ?? false}
                          />
                          <Link href={`/matchs/${match.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

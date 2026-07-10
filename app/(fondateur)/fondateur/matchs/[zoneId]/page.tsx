import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Plus, Trophy } from "lucide-react";
import { MATCH_STATUS_LABELS, MATCH_STATUS_COLORS } from "@/lib/constants";
import { formatDateShort, formatFCFA } from "@/lib/format";
import { PrintBlocsButton } from "@/app/(admin)/matchs/print-blocs-button";

export const metadata = { title: "Matchs de zone — Fondateur" };

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function FondateurZoneMatchsPage({
  params,
}: {
  params: Promise<{ zoneId: string }>;
}) {
  await requireRole(["fondateur"]);
  const { zoneId } = await params;
  const adminClient = await createAdminClient();

  const { data: zone } = await adminClient
    .from("zones")
    .select("id, name, president")
    .eq("id", zoneId)
    .single();

  if (!zone) notFound();

  const { data: matches } = await adminClient
    .from("matches")
    .select("*")
    .eq("zone_id", zoneId)
    .order("match_date", { ascending: false });

  const matchIds = (matches || []).map((m: any) => m.id as string);
  let ticketStats: Record<string, { count: number; revenue: number }> = {};

  if (matchIds.length > 0) {
    const { data: tickets } = await adminClient
      .from("tickets")
      .select("match_id, price")
      .in("match_id", matchIds)
      .eq("counts_as_revenue", true);

    if (tickets) {
      ticketStats = tickets.reduce(
        (acc, t: any) => {
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
      <div className="flex items-center gap-3">
        <Link href="/fondateur/matchs">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Zones
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold font-heading">{zone.name}</h1>
          <p className="text-muted-foreground text-sm">{matches?.length || 0} match(s)</p>
        </div>
      </div>

      <div className="flex justify-end">
        <Link href={`/fondateur/matchs/${zoneId}/nouveau`}>
          <Button className="bg-brand hover:bg-brand/90">
            <Plus className="h-4 w-4 mr-2" />
            Nouveau match
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
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
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="hidden sm:table-cell">Statut</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Billets imprimés</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Recettes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(matches as any[]).map((match) => {
                  const stats = ticketStats[match.id] || { count: 0, revenue: 0 };
                  return (
                    <TableRow key={match.id}>
                      <TableCell className="font-medium">
                        {match.home_team} vs {match.away_team}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {formatDateShort(match.match_date)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="secondary" className={MATCH_STATUS_COLORS[match.status]}>
                          {MATCH_STATUS_LABELS[match.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {match.status === "termine" && match.home_score !== null ? (
                          <span className="inline-block bg-brand text-white text-xs font-bold px-2 py-0.5 rounded">
                            {match.home_score} - {match.away_score}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right">
                        {stats.count > 0 ? (
                          <span className="font-semibold">{stats.count.toLocaleString("fr-FR")}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right">
                        {stats.revenue > 0 ? formatFCFA(stats.revenue) : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {match.status !== "termine" && match.status !== "annule" && (
                          <PrintBlocsButton
                            matchId={match.id}
                            matchName={`${match.home_team} vs ${match.away_team}`}
                          />
                        )}
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

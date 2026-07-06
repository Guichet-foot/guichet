import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveZone } from "@/lib/get-effective-zone";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trophy, Eye } from "lucide-react";
import { MATCH_STATUS_LABELS, MATCH_STATUS_COLORS } from "@/lib/constants";
import { formatDateShort, formatFCFA } from "@/lib/format";
import { buildZoneUrl } from "@/lib/zone-utils";
import { MatchActionButtons } from "./match-action-buttons";
import { MatchMobileActions } from "./match-mobile-actions";
import { PrintBlocsButton } from "./print-blocs-button";
import { ZoneCardGrid } from "@/components/zone-card-grid";
import { ZoneBackHeader } from "@/components/zone-back-header";

export const metadata = { title: "Matchs" };

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function MatchsPage({
  searchParams,
}: {
  searchParams: Promise<{ zone?: string }>;
}) {
  const profile = await requireRole(["super_admin", "admin_zone", "c3", "fondateur"]);
  const params = await searchParams;
  const { effectiveZoneId, selectedZone, ownedZones, needsZoneSelection, c3AccountId } =
    await getEffectiveZone(profile, params.zone);

  if (needsZoneSelection) {
    return <ZoneCardGrid zones={ownedZones} title="Matchs" />;
  }

  const supabase = await createClient();

  let query = supabase.from("matches").select("*").order("match_date", { ascending: false });
  if (c3AccountId) query = query.eq("c3_account_id", c3AccountId);
  else if (effectiveZoneId) query = query.eq("zone_id", effectiveZoneId);

  const { data: matches } = await query;

  const matchIds = matches?.map((m) => m.id) || [];
  let ticketStats: Record<string, { count: number; revenue: number }> = {};

  if (matchIds.length > 0) {
    const { data: tickets } = await supabase
      .from("tickets")
      .select("match_id, price")
      .in("match_id", matchIds)
      .eq("counts_as_revenue", true);

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
      {profile.role === "super_admin" && selectedZone && <ZoneBackHeader zoneName={selectedZone.name} />}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading">Matchs</h1>
          <p className="text-muted-foreground">{matches?.length || 0} match(s)</p>
        </div>
        <Link href={buildZoneUrl("/matchs/nouveau", params.zone)}>
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
                  <TableHead className="hidden lg:table-cell text-right">Billets</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Recettes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map((match: any) => {
                  const stats = ticketStats[match.id] || { count: 0, revenue: 0 };
                  return (
                    <TableRow key={match.id}>
                      <TableCell className="font-medium">{match.home_team} vs {match.away_team}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{formatDateShort(match.match_date)}</TableCell>
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
                        <div className="text-right leading-tight">
                          <span>{stats.count}</span>
                          {stats.count >= 100 && (
                            <p className="text-xs text-muted-foreground">
                              {Math.floor(stats.count / 100)} bloc{Math.floor(stats.count / 100) > 1 ? "s" : ""}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right">{formatFCFA(stats.revenue)}</TableCell>
                      <TableCell className="text-right">
                        {/* Desktop: inline buttons */}
                        <div className="hidden sm:flex items-center gap-1 justify-end">
                          {(profile.role === "super_admin" || profile.role === "fondateur") &&
                            match.status !== "termine" && match.status !== "annule" && (
                              <PrintBlocsButton
                                matchId={match.id}
                                matchName={`${match.home_team} vs ${match.away_team}`}
                              />
                          )}
                          <MatchActionButtons matchId={match.id} zoneId={match.zone_id} status={match.status} venteActive={match.vente_active ?? false} homeTeam={match.home_team} awayTeam={match.away_team} />
                          <Link href={buildZoneUrl(`/matchs/${match.id}`, params.zone)}>
                            <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                          </Link>
                        </div>
                        {/* Mobile: single button → popup */}
                        <div className="sm:hidden">
                          <MatchMobileActions
                            match={{ id: match.id, zone_id: match.zone_id, home_team: match.home_team, away_team: match.away_team, venue: match.venue || "", match_date: match.match_date, status: match.status, vente_active: match.vente_active ?? false, home_score: match.home_score, away_score: match.away_score }}
                            stats={stats}
                            detailUrl={buildZoneUrl(`/matchs/${match.id}`, params.zone)}
                          />
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

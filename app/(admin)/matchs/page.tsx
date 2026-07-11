import { requireRole } from "@/lib/auth";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getEffectiveZone } from "@/lib/get-effective-zone";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trophy, Eye, Pencil } from "lucide-react";
import { MATCH_STATUS_LABELS, MATCH_STATUS_COLORS } from "@/lib/constants";
import { formatDateShort } from "@/lib/format";
import { buildZoneUrl } from "@/lib/zone-utils";
import { MatchActionButtons } from "./match-action-buttons";
import { MatchMobileActions } from "./match-mobile-actions";
import { BilleterieSessionButton } from "./billeterie-session-button";
import { PrintBlocsButton } from "./print-blocs-button";
import { ZoneCardGrid } from "@/components/zone-card-grid";
import { ZoneBackHeader } from "@/components/zone-back-header";
import { MatchTabBar } from "./match-tab-bar";

export const metadata = { title: "Matchs" };

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function MatchsPage({
  searchParams,
}: {
  searchParams: Promise<{ zone?: string }>;
}) {
  const profile = await requireRole(["super_admin", "admin_zone", "c3", "fondateur"]);
  const params = await searchParams;

  const isOdcavRole =
    profile.role === "super_admin" ||
    profile.role === "president_odcav" ||
    profile.role === "tresorier";

  const { effectiveZoneId, selectedZone, ownedZones, needsZoneSelection, c3AccountId } =
    await getEffectiveZone(profile, params.zone);

  if (needsZoneSelection) {
    return (
      <div className="space-y-6">
        {isOdcavRole && <MatchTabBar active="zonaux" />}
        <ZoneCardGrid zones={ownedZones} title="Matchs" />
      </div>
    );
  }

  const supabase = await createClient();
  const adminClient = await createAdminClient();

  // Fetch zone billeterie session
  let zoneOpenUntil: string | null = null;
  if (effectiveZoneId) {
    const { data: zoneData } = await adminClient
      .from("zones")
      .select("billeterie_open_until")
      .eq("id", effectiveZoneId)
      .single();
    zoneOpenUntil = zoneData?.billeterie_open_until || null;
  }

  let query = supabase.from("matches").select("*").order("match_date", { ascending: false });
  if (c3AccountId) query = query.eq("c3_account_id", c3AccountId);
  else if (effectiveZoneId) query = query.eq("zone_id", effectiveZoneId);

  const { data: matches } = await query;

  return (
    <div className="space-y-6">
      {isOdcavRole && !params.zone && <MatchTabBar active="zonaux" />}
      {isOdcavRole && selectedZone && <ZoneBackHeader zoneName={selectedZone.name} />}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading">Matchs</h1>
          <p className="text-muted-foreground">{matches?.length || 0} match(s)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {effectiveZoneId && (
            <BilleterieSessionButton
              zoneId={effectiveZoneId}
              openUntil={zoneOpenUntil}
            />
          )}
          <Link href={buildZoneUrl("/matchs/nouveau", params.zone)}>
            <Button className="bg-brand hover:bg-brand/90">
              <Plus className="h-4 w-4 mr-2" />
              Nouveau match
            </Button>
          </Link>
        </div>
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
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map((match: any) => (
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
                    <TableCell className="text-right">
                      <div className="hidden sm:flex items-center gap-1 justify-end">
                        {(profile.role === "super_admin" || profile.role === "fondateur" || profile.role === "president_odcav") &&
                          match.status !== "termine" && match.status !== "annule" && (
                            <PrintBlocsButton
                              matchId={match.id}
                              matchName={`${match.home_team} vs ${match.away_team}`}
                            />
                        )}
                        <MatchActionButtons matchId={match.id} zoneId={match.zone_id} status={match.status} venteActive={match.vente_active ?? false} homeTeam={match.home_team} awayTeam={match.away_team} />
                        {match.status !== "termine" && match.status !== "annule" && profile.role !== "fondateur" && (
                          <Link href={buildZoneUrl(`/matchs/${match.id}/modifier`, params.zone)}>
                            <Button variant="ghost" size="sm" title="Modifier le match">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </Link>
                        )}
                        <Link href={buildZoneUrl(`/matchs/${match.id}`, params.zone)}>
                          <Button variant="ghost" size="sm" title="Voir les détails"><Eye className="h-4 w-4" /></Button>
                        </Link>
                      </div>
                      <div className="sm:hidden">
                        <MatchMobileActions
                          match={{ id: match.id, zone_id: match.zone_id, home_team: match.home_team, away_team: match.away_team, venue: match.venue || "", match_date: match.match_date, status: match.status, vente_active: match.vente_active ?? false, home_score: match.home_score, away_score: match.away_score }}
                          detailUrl={buildZoneUrl(`/matchs/${match.id}`, params.zone)}
                          editUrl={profile.role !== "fondateur" ? buildZoneUrl(`/matchs/${match.id}/modifier`, params.zone) : undefined}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

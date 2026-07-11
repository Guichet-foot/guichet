import { requireRole } from "@/lib/auth";
import { getOdcavInterMatches } from "@/lib/actions/odcav-match-actions";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trophy } from "lucide-react";
import { MATCH_STATUS_LABELS, MATCH_STATUS_COLORS } from "@/lib/constants";
import { formatDateShort } from "@/lib/format";
import { PrintBlocsButton } from "@/app/(admin)/matchs/print-blocs-button";
import { MatchActionButtons } from "@/app/(admin)/matchs/match-action-buttons";
import { MatchTabBar } from "@/app/(admin)/matchs/match-tab-bar";
import { ScanSessionButton } from "@/components/scan-session-button";
import { openOdcavScanSession, closeOdcavScanSession, getOdcavScanSession } from "@/lib/actions/billeterie-session-actions";

export const metadata = { title: "Matchs Communal" };

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function MatchsCommunauxPage() {
  const profile = await requireRole(["super_admin", "fondateur"]);
  const [matches, odcavOpenUntil] = await Promise.all([
    getOdcavInterMatches("Match Communal"),
    getOdcavScanSession(),
  ]);

  return (
    <div className="space-y-6">
      <MatchTabBar active="communaux" />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading">Matchs Communal</h1>
          <p className="text-muted-foreground">{matches.length} match(s)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ScanSessionButton
            openUntil={odcavOpenUntil}
            openAction={openOdcavScanSession}
            closeAction={closeOdcavScanSession}
          />
          <Link href="/matchs/communaux/nouveau">
            <Button className="bg-brand hover:bg-brand/90">
              <Plus className="h-4 w-4 mr-2" />
              Nouveau match communal
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {matches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Trophy className="h-12 w-12 mb-4" />
              <p>Aucun match communal</p>
              <p className="text-sm mt-1">Créez des matchs entre équipes de zones différentes</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Match</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="hidden sm:table-cell">Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(matches as any[]).map((match) => {
                  const homeDisplay = match.home_team_zone
                    ? `${match.home_team} (${match.home_team_zone})`
                    : match.home_team;
                  const awayDisplay = match.away_team_zone
                    ? `${match.away_team} (${match.away_team_zone})`
                    : match.away_team;
                  return (
                    <TableRow key={match.id}>
                      <TableCell className="font-medium">
                        <span>{homeDisplay}</span>
                        <span className="text-muted-foreground mx-1 text-xs">vs</span>
                        <span>{awayDisplay}</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {formatDateShort(match.match_date)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="secondary" className={MATCH_STATUS_COLORS[match.status]}>
                          {MATCH_STATUS_LABELS[match.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-1 justify-end">
                          {profile.role === "fondateur" && match.status !== "termine" && match.status !== "annule" && (
                            <PrintBlocsButton
                              matchId={match.id}
                              matchName={`${match.home_team} vs ${match.away_team}`}
                            />
                          )}
                          <MatchActionButtons
                            matchId={match.id}
                            zoneId={null}
                            status={match.status}
                            venteActive={match.vente_active ?? false}
                            homeTeam={match.home_team}
                            awayTeam={match.away_team}
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

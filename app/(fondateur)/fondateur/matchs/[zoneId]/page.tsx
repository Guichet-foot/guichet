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
import { formatDateShort } from "@/lib/format";
import { PrintBlocsButton } from "@/app/(admin)/matchs/print-blocs-button";
import { MatchApercuDialog } from "../match-apercu-dialog";
import { fetchAll } from "@/lib/supabase/paginate";

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
  let ticketStats: Record<string, { printed: number; validated: number; printedRevenue: number; validatedRevenue: number }> = {};
  const bilStats: Record<string, { bilPrinted: number; bilValidated: number }> = {};

  if (matchIds.length > 0) {
    const { data: tickets } = await adminClient
      .from("tickets")
      .select("match_id, price, bloc_printed, status")
      .in("match_id", matchIds)
      .neq("status", "annule");

    if (tickets) {
      ticketStats = tickets.reduce(
        (acc, t: any) => {
          if (!acc[t.match_id]) acc[t.match_id] = { printed: 0, validated: 0, printedRevenue: 0, validatedRevenue: 0 };
          if (t.bloc_printed) {
            acc[t.match_id].printed++;
            acc[t.match_id].printedRevenue += t.price;
          }
          if (t.status === "scanne") {
            acc[t.match_id].validated++;
            acc[t.match_id].validatedRevenue += t.price;
          }
          return acc;
        },
        {} as Record<string, { printed: number; validated: number; printedRevenue: number; validatedRevenue: number }>
      );
    }

    // Add billeterie invendus to each match's printed/validated counts.
    // For match M: bilPrinted = non-withdrawn - scans at OTHER matches in same billeterie
    // (= invendus available for M at any given moment)
    const { data: allBils } = await adminClient
      .from("billeterie")
      .select("id, match_ids");
    const relevantBils = (allBils || []).filter((b: any) =>
      (b.match_ids || []).some((mid: string) => matchIds.includes(mid))
    );

    if (relevantBils.length > 0) {
      const bilIds = relevantBils.map((b: any) => b.id as string);
      // All match IDs across these billeteries (for fetching scans outside this zone too)
      const allBilMatchIds = [...new Set(
        relevantBils.flatMap((b: any) => (b.match_ids || []) as string[])
      )];

      // Fetch all tickets (with/without withdrawn) for ID→bilId map + non-withdrawn count
      const bilAllTickets = await fetchAll<any>((from, to) =>
        adminClient.from("billeterie_tickets")
          .select("id, billeterie_id, withdrawn")
          .in("billeterie_id", bilIds)
          .range(from, to)
      );

      const bilTicketCountByBilId: Record<string, number> = {};
      const ticketIdToBilId: Record<string, string> = {};
      bilAllTickets.forEach((t: any) => {
        ticketIdToBilId[t.id] = t.billeterie_id;
        if (!t.withdrawn) {
          bilTicketCountByBilId[t.billeterie_id] = (bilTicketCountByBilId[t.billeterie_id] || 0) + 1;
        }
      });

      // Scans across ALL matches in these billeteries (not just this zone)
      const bilScans = await fetchAll<any>((from, to) =>
        adminClient.from("billeterie_scans")
          .select("ticket_id, match_id")
          .in("match_id", allBilMatchIds)
          .range(from, to)
      );

      // Per billeterie: total scans and scans per match
      const totalScansByBil: Record<string, number> = {};
      const scansByBilAndMatch: Record<string, Record<string, number>> = {};
      bilScans.forEach((s: any) => {
        const bilId = ticketIdToBilId[s.ticket_id];
        if (!bilId) return;
        totalScansByBil[bilId] = (totalScansByBil[bilId] || 0) + 1;
        if (!scansByBilAndMatch[bilId]) scansByBilAndMatch[bilId] = {};
        scansByBilAndMatch[bilId][s.match_id] = (scansByBilAndMatch[bilId][s.match_id] || 0) + 1;
      });

      matchIds.forEach((mId: string) => {
        const bilsForMatch = relevantBils.filter((b: any) => (b.match_ids || []).includes(mId));
        let bilPrinted = 0;
        let bilValidated = 0;
        bilsForMatch.forEach((b: any) => {
          const nonWithdrawn = bilTicketCountByBilId[b.id] || 0;
          const totalScans = totalScansByBil[b.id] || 0;
          const scansAtM = (scansByBilAndMatch[b.id] || {})[mId] || 0;
          // Available for M = non-withdrawn minus scans that happened at OTHER matches
          bilPrinted += Math.max(0, nonWithdrawn - (totalScans - scansAtM));
          bilValidated += scansAtM;
        });
        bilStats[mId] = { bilPrinted, bilValidated };
      });
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
                  <TableHead className="hidden lg:table-cell text-right">Imprimés</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Validés</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(matches as any[]).map((match) => {
                  const stats = ticketStats[match.id] || { printed: 0, validated: 0, printedRevenue: 0, validatedRevenue: 0 };
                  const bil = bilStats[match.id] || { bilPrinted: 0, bilValidated: 0 };
                  const totalPrinted = stats.printed + bil.bilPrinted;
                  const totalValidated = stats.validated + bil.bilValidated;
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
                      <TableCell className="hidden lg:table-cell text-right">
                        {totalPrinted > 0 ? (
                          <span className="font-semibold">{totalPrinted.toLocaleString("fr-FR")}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right">
                        {totalValidated > 0 ? (
                          <span className="font-semibold text-success">{totalValidated.toLocaleString("fr-FR")}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <MatchApercuDialog
                            matchName={`${match.home_team} vs ${match.away_team}`}
                            stats={{ ...stats, bilPrinted: bil.bilPrinted, bilValidated: bil.bilValidated }}
                          />
                          {match.status !== "termine" && match.status !== "annule" && (
                            <PrintBlocsButton
                              matchId={match.id}
                              matchName={`${match.home_team} vs ${match.away_team}`}
                            />
                          )}
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

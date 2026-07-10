import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { MapPin, Trophy, Plus, Network } from "lucide-react";
import Link from "next/link";
import { MATCH_STATUS_LABELS, MATCH_STATUS_COLORS } from "@/lib/constants";
import { formatDateShort } from "@/lib/format";
import { PrintBlocsButton } from "@/app/(admin)/matchs/print-blocs-button";

export const metadata = { title: "Matchs — Fondateur" };

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function FondateurMatchsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireRole(["fondateur"]);
  const { tab } = await searchParams;
  const activeTab = tab === "direct" ? "direct" : "zones";

  const adminClient = await createAdminClient();

  if (activeTab === "direct") {
    const { data: directMatches } = await adminClient
      .from("matches")
      .select("*")
      .eq("is_direct", true)
      .order("match_date", { ascending: false });

    const matchIds = (directMatches || []).map((m: any) => m.id as string);
    let ticketStats: Record<string, { printed: number; validated: number }> = {};

    if (matchIds.length > 0) {
      const { data: tickets } = await adminClient
        .from("tickets")
        .select("match_id, bloc_printed, status")
        .in("match_id", matchIds)
        .neq("status", "annule");

      if (tickets) {
        ticketStats = tickets.reduce(
          (acc, t: any) => {
            if (!acc[t.match_id]) acc[t.match_id] = { printed: 0, validated: 0 };
            if (t.bloc_printed) acc[t.match_id].printed++;
            if (t.status === "scanne") acc[t.match_id].validated++;
            return acc;
          },
          {} as Record<string, { printed: number; validated: number }>
        );
      }
    }

    return (
      <div className="space-y-6">
        <TabBar active="direct" />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-heading">Matchs directs</h1>
            <p className="text-muted-foreground text-sm">{directMatches?.length || 0} match(s)</p>
          </div>
          <Link href="/fondateur/matchs/direct/nouveau">
            <Button className="bg-brand hover:bg-brand/90">
              <Plus className="h-4 w-4 mr-2" />
              Nouveau match direct
            </Button>
          </Link>
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            {!directMatches || directMatches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Network className="h-12 w-12 mb-4" />
                <p>Aucun match direct créé</p>
                <p className="text-sm mt-1">Créez des matchs inter-zones sans passer par une zone spécifique</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Match</TableHead>
                    <TableHead className="hidden sm:table-cell">Type</TableHead>
                    <TableHead className="hidden md:table-cell">Date</TableHead>
                    <TableHead className="hidden sm:table-cell">Statut</TableHead>
                    <TableHead className="hidden lg:table-cell text-right">Billets imprimés</TableHead>
                    <TableHead className="hidden lg:table-cell text-right">Billets validés</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(directMatches as any[]).map((match) => {
                    const homeDisplay = match.home_team_zone
                      ? `${match.home_team} (${match.home_team_zone})`
                      : match.home_team;
                    const awayDisplay = match.away_team_zone
                      ? `${match.away_team} (${match.away_team_zone})`
                      : match.away_team;
                    const stats = ticketStats[match.id] || { printed: 0, validated: 0 };
                    return (
                      <TableRow key={match.id}>
                        <TableCell className="font-medium">
                          <div className="leading-tight">
                            <span>{homeDisplay}</span>
                            <span className="text-muted-foreground mx-1 text-xs">vs</span>
                            <span>{awayDisplay}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                          {match.match_type || "—"}
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
                          {stats.printed > 0 ? (
                            <span className="font-semibold">{stats.printed.toLocaleString("fr-FR")}</span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-right">
                          {stats.validated > 0 ? (
                            <span className="font-semibold text-success">{stats.validated.toLocaleString("fr-FR")}</span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
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

  // ── Tab Zones (default) ───────────────────────────────────────────
  const { data: zones } = await adminClient
    .from("zones")
    .select("id, name, region, president, logo")
    .order("name");

  const zoneList = (zones || []) as {
    id: string; name: string; region: string | null;
    president: string | null; logo: string | null;
  }[];

  return (
    <div className="space-y-6">
      <TabBar active="zones" />
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center">
          <Trophy className="h-6 w-6 text-brand" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading">Matchs Zone</h1>
          <p className="text-muted-foreground text-sm">Sélectionnez une zone</p>
        </div>
      </div>

      {zoneList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <MapPin className="h-16 w-16 mb-4 opacity-30" />
          <p className="text-lg">Aucune zone</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {zoneList.map((zone) => (
            <Link key={zone.id} href={`/fondateur/matchs/${zone.id}`}>
              <Card className="cursor-pointer hover:border-brand/50 hover:shadow-md transition-all">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    {zone.logo ? (
                      <img src={zone.logo} alt={zone.name} className="w-12 h-12 rounded-lg object-cover border" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
                        <MapPin className="h-6 w-6 text-brand" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="font-semibold text-lg truncate">{zone.name}</h3>
                      {zone.region && <p className="text-sm text-muted-foreground">{zone.region}</p>}
                      {zone.president && (
                        <p className="text-xs text-muted-foreground mt-1">Président : {zone.president}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function TabBar({ active }: { active: "zones" | "direct" }) {
  return (
    <div className="flex gap-1 border-b">
      <Link
        href="/fondateur/matchs"
        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
          active === "zones"
            ? "border-brand text-brand"
            : "border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        <MapPin className="h-4 w-4" />
        Match Zone
      </Link>
      <Link
        href="/fondateur/matchs?tab=direct"
        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
          active === "direct"
            ? "border-brand text-brand"
            : "border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        <Network className="h-4 w-4" />
        Match Direct
      </Link>
    </div>
  );
}

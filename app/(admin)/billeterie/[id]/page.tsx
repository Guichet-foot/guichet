import { requireRole } from "@/lib/auth";
import { getBilleterieDetails } from "@/lib/actions/billeterie-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trophy, Ticket, ScanLine } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatFCFA } from "@/lib/format";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { AddTicketsDialog, WithdrawBatchButton } from "./billeterie-actions-client";

export const metadata = { title: "Détail Billetterie" };

/* eslint-disable @typescript-eslint/no-explicit-any */

function matchStatus(status: string) {
  if (status === "en_cours") return <Badge className="bg-green-600 text-white text-xs">En cours</Badge>;
  if (status === "termine") return <Badge variant="secondary" className="text-xs">Terminé</Badge>;
  return <Badge variant="outline" className="text-xs">Programmé</Badge>;
}

export default async function BilleterieDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireRole(["super_admin", "fondateur"]);
  const { id } = await params;
  const bil = await getBilleterieDetails(id);
  if (!bil) notFound();

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/billeterie">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold font-heading">{bil.name}</h1>
          <p className="text-sm text-muted-foreground">
            Créé le {format(new Date(bil.createdAt), "d MMMM yyyy", { locale: fr })}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-brand" />
              <div>
                <p className="text-2xl font-bold">{bil.totalTickets}</p>
                <p className="text-xs text-muted-foreground">Billets</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{bil.totalScans}</p>
                <p className="text-xs text-muted-foreground">Scans</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div>
              <p className="text-2xl font-bold text-brand">{formatFCFA(bil.price)}</p>
              <p className="text-xs text-muted-foreground">Prix / billet</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Matchs inclus */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-brand" />
            Matchs inclus ({bil.matches.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {bil.matches.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun match</p>
          ) : (
            bil.matches.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-semibold">
                    {m.home_team_zone ? `${m.home_team} (${m.home_team_zone})` : m.home_team}
                    {" vs "}
                    {m.away_team_zone ? `${m.away_team} (${m.away_team_zone})` : m.away_team}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(m.match_date), "EEE d MMM yyyy · HH'h'mm", { locale: fr })}
                    {m.match_type && ` · ${m.match_type}`}
                  </p>
                </div>
                {matchStatus(m.status)}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Lots d'impression — fondateur uniquement */}
      {profile.role === "fondateur" && <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
                <CardTitle className="text-base">Imprimer</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{bil.totalTickets} billet{bil.totalTickets !== 1 ? "s" : ""} imprimé{bil.totalTickets !== 1 ? "s" : ""}</p>
              </div>
            <AddTicketsDialog billeterieId={bil.id} />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {bil.batches.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun lot généré</p>
          ) : (
            bil.batches.map((batch: any) => {
              const activeCount = batch.count - batch.withdrawnCount;
              return (
                <div key={batch.batchId} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {activeCount} billet{activeCount !== 1 ? "s" : ""}
                      {batch.withdrawnCount > 0 && (
                        <span className="ml-2 text-xs text-red-500 font-normal">({batch.withdrawnCount} retiré{batch.withdrawnCount !== 1 ? "s" : ""})</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(batch.createdAt), "d MMM yyyy HH:mm", { locale: fr })}
                    </p>
                  </div>
                  {activeCount > 0 && (
                    <WithdrawBatchButton batchId={batch.batchId} activeCount={activeCount} />
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>}
    </div>
  );
}

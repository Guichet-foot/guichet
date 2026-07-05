"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { declareToutVendus } from "@/lib/actions/invendus-actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  PackageX,
  ScanLine,
  Loader2,
  CalendarDays,
  MapPin,
} from "lucide-react";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Match {
  id: string;
  home_team: string;
  away_team: string;
  match_date: string;
  venue: string;
  zone: { name: string } | null;
}

interface UnsoldEntry {
  id: string;
  match_id: string;
  unsold_count: number;
  tout_vendus: boolean;
  declared_at: string;
}

interface Props {
  matches: Match[];
  unsoldMap: Record<string, UnsoldEntry>;
}

export function InvendusList({ matches, unsoldMap }: Props) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [confirmMatch, setConfirmMatch] = useState<Match | null>(null);

  async function handleToutVendus(matchId: string) {
    setLoadingId(matchId);
    const result = await declareToutVendus(matchId);
    setLoadingId(null);
    setConfirmMatch(null);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Déclaré : tous les billets vendus");
    router.refresh();
  }

  if (matches.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          <PackageX className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Aucun match terminé pour l&apos;instant.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {matches.map((match) => {
          const unsold = unsoldMap[match.id];
          const isDeclared = !!unsold;
          const isToutVendus = unsold?.tout_vendus;
          const hasUnsold = isDeclared && !isToutVendus && unsold.unsold_count > 0;
          const isLoading = loadingId === match.id;

          return (
            <Card
              key={match.id}
              className={`transition-colors ${isDeclared ? "border-green-200 bg-green-50/40" : ""}`}
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Match info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-base leading-snug">
                      {match.home_team} <span className="text-muted-foreground font-normal">vs</span> {match.away_team}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {formatDate(match.match_date)}
                      </span>
                      {match.venue && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {match.venue}
                        </span>
                      )}
                      {match.zone?.name && (
                        <Badge variant="outline" className="text-xs py-0 h-5">{match.zone.name}</Badge>
                      )}
                    </div>
                  </div>

                  {/* Status + actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {isDeclared ? (
                      isToutVendus ? (
                        <Badge className="bg-green-600 text-white gap-1 text-xs">
                          <CheckCircle2 className="h-3 w-3" />Tout vendus
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-red-300 text-red-700 gap-1 text-xs">
                          <PackageX className="h-3 w-3" />{unsold.unsold_count} invendu(s) scanné(s)
                        </Badge>
                      )
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground text-xs">
                        Non déclaré
                      </Badge>
                    )}

                    <Link href={`/invendus/${match.id}/scanner`}>
                      <Button size="sm" variant="outline" className="gap-1 text-xs h-8">
                        <ScanLine className="h-3.5 w-3.5" />
                        {isDeclared && hasUnsold ? "Scanner +" : "Ajouter invendus"}
                      </Button>
                    </Link>

                    <Button
                      size="sm"
                      variant={isToutVendus ? "ghost" : "outline"}
                      className={`gap-1 text-xs h-8 ${isToutVendus ? "text-muted-foreground" : "border-green-600 text-green-700 hover:bg-green-50"}`}
                      onClick={() => setConfirmMatch(match)}
                      disabled={isLoading || isToutVendus}
                    >
                      {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      Tout vendus
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Confirm "Tout vendus" dialog */}
      <Dialog open={!!confirmMatch} onOpenChange={() => setConfirmMatch(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmer : Tout vendus ?</DialogTitle>
          </DialogHeader>
          {confirmMatch && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Vous confirmez que <strong>tous les billets imprimés</strong> pour{" "}
                <strong>{confirmMatch.home_team} vs {confirmMatch.away_team}</strong> ont été vendus — aucun invendu.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setConfirmMatch(null)}>
                  Annuler
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => handleToutVendus(confirmMatch.id)}
                  disabled={!!loadingId}
                >
                  {loadingId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  Confirmer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo, useEffect } from "react";
import { declareToutVendus, closeMatchUnsold } from "@/lib/actions/invendus-actions";
import { UnsoldModal } from "./unsold-modal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Lock,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

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
  is_closed: boolean;
  declared_at: string;
}

type ConfirmType = "tout_vendus" | "terminer";

interface Props {
  matches: Match[];
  unsoldMap: Record<string, UnsoldEntry>;
  readOnly?: boolean;
}

const PAGE_SIZE = 15;

export function InvendusList({ matches, unsoldMap, readOnly = false }: Props) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ match: Match; type: ConfirmType } | null>(null);
  const [unsoldModal, setUnsoldModal] = useState<{ match: Match } | null>(null);
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [page, setPage] = useState(1);

  // Clôturés toujours en bas
  const sorted = useMemo(() => [...matches].sort((a, b) => {
    const aClosed = unsoldMap[a.id]?.is_closed === true;
    const bClosed = unsoldMap[b.id]?.is_closed === true;
    if (aClosed === bClosed) return 0;
    return aClosed ? 1 : -1;
  }), [matches, unsoldMap]);

  const filtered = useMemo(() => sorted.filter((m) => {
    const name = `${m.home_team} ${m.away_team}`.toLowerCase();
    const matchesSearch = !search || name.includes(search.toLowerCase());
    const matchesMonth = !monthFilter || m.match_date.startsWith(monthFilter);
    return matchesSearch && matchesMonth;
  }), [sorted, search, monthFilter]);

  useEffect(() => { setPage(1); }, [search, monthFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function handleToutVendus(matchId: string) {
    setLoadingId(matchId);
    const result = await declareToutVendus(matchId);
    setLoadingId(null);
    setConfirmDialog(null);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Déclaré : tous les billets vendus");
    router.refresh();
  }

  async function handleTerminer(matchId: string) {
    setLoadingId(matchId);
    const result = await closeMatchUnsold(matchId);
    setLoadingId(null);
    setConfirmDialog(null);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Match clôturé — déclaration verrouillée");
    router.refresh();
  }

  return (
    <>
      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un match..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <input
          type="month"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring w-full sm:w-44"
        />
      </div>

      {/* Résultats */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <PackageX className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>{matches.length === 0 ? "Aucun match terminé pour l'instant." : "Aucun match correspond aux filtres."}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {paginated.map((match) => {
            const unsold = unsoldMap[match.id];
            const isClosed = unsold?.is_closed === true;
            const isToutVendus = unsold?.tout_vendus === true;
            const isDeclared = !!unsold;
            const hasUnsold = isDeclared && !isToutVendus && unsold.unsold_count > 0;
            const isLoading = loadingId === match.id;

            return (
              <Card
                key={match.id}
                className={`transition-colors ${
                  isClosed
                    ? "border-slate-200 bg-slate-50/60 opacity-80"
                    : isDeclared
                      ? "border-green-200 bg-green-50/40"
                      : ""
                }`}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Infos match */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-base leading-snug">
                          {match.home_team} <span className="text-muted-foreground font-normal">vs</span> {match.away_team}
                        </p>
                        {isClosed && <Lock className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                      </div>
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

                    {/* Statut + actions */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {/* Badge clôturé + nombre invendus visible même après clôture */}
                      {isClosed && (
                        <Badge className="bg-slate-600 text-white gap-1 text-xs">
                          <Lock className="h-3 w-3" />Clôturé
                        </Badge>
                      )}
                      {/* Badge invendus/tout vendus : toujours visible */}
                      {isToutVendus ? (
                        <Badge className="bg-green-600 text-white gap-1 text-xs">
                          <CheckCircle2 className="h-3 w-3" />Tout vendus
                        </Badge>
                      ) : isDeclared && unsold.unsold_count > 0 ? (
                        <Badge variant="outline" className="border-red-300 text-red-700 gap-1 text-xs">
                          <PackageX className="h-3 w-3" />{unsold.unsold_count} invendu(s)
                        </Badge>
                      ) : !isClosed && !isDeclared ? (
                        <Badge variant="outline" className="text-muted-foreground text-xs">
                          Non déclaré
                        </Badge>
                      ) : null}

                      {/* Boutons d'action — masqués si readOnly */}
                      {!readOnly && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-xs h-8"
                            disabled={isClosed}
                            onClick={() => setUnsoldModal({ match })}
                          >
                            <ScanLine className="h-3.5 w-3.5" />
                            {isDeclared && hasUnsold ? "Modifier" : "Ajouter invendus"}
                          </Button>

                          <Button
                            size="sm"
                            variant={isToutVendus ? "ghost" : "outline"}
                            className={`gap-1 text-xs h-8 ${
                              isToutVendus || isClosed
                                ? "text-muted-foreground"
                                : "border-green-600 text-green-700 hover:bg-green-50"
                            }`}
                            onClick={() => setConfirmDialog({ match, type: "tout_vendus" })}
                            disabled={isLoading || isToutVendus || isClosed}
                          >
                            {isLoading
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <CheckCircle2 className="h-3.5 w-3.5" />
                            }
                            Tout vendus
                          </Button>

                          <Button
                            size="sm"
                            variant={isClosed ? "ghost" : "outline"}
                            className={`gap-1 text-xs h-8 ${
                              isClosed
                                ? "text-muted-foreground"
                                : "border-slate-500 text-slate-700 hover:bg-slate-50"
                            }`}
                            onClick={() => setConfirmDialog({ match, type: "terminer" })}
                            disabled={isLoading || isClosed}
                          >
                            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                            Terminer
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            {filtered.length} match(s) · Page {page}/{totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Suivant
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Modal invendus par catégorie */}
      {unsoldModal && (
        <UnsoldModal
          matchId={unsoldModal.match.id}
          matchName={`${unsoldModal.match.home_team} vs ${unsoldModal.match.away_team}`}
          open={!!unsoldModal}
          onClose={() => setUnsoldModal(null)}
        />
      )}

      {/* Dialogs de confirmation */}
      <Dialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent className="max-w-sm">
          {confirmDialog?.type === "tout_vendus" && (
            <>
              <DialogHeader>
                <DialogTitle>Confirmer : Tout vendus ?</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Vous confirmez que <strong>tous les billets imprimés</strong> pour{" "}
                  <strong>{confirmDialog.match.home_team} vs {confirmDialog.match.away_team}</strong> ont été vendus — aucun invendu.
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setConfirmDialog(null)}>Annuler</Button>
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleToutVendus(confirmDialog.match.id)}
                    disabled={!!loadingId}
                  >
                    {loadingId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    Confirmer
                  </Button>
                </div>
              </div>
            </>
          )}

          {confirmDialog?.type === "terminer" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Lock className="h-4 w-4" /> Terminer et verrouiller ?
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  La déclaration d&apos;invendus pour{" "}
                  <strong>{confirmDialog.match.home_team} vs {confirmDialog.match.away_team}</strong> sera{" "}
                  <strong>définitivement verrouillée</strong>. Les boutons &quot;Ajouter invendus&quot; et &quot;Tout vendus&quot; seront désactivés.
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setConfirmDialog(null)}>Annuler</Button>
                  <Button
                    className="flex-1 bg-slate-700 hover:bg-slate-800 text-white"
                    onClick={() => handleTerminer(confirmDialog.match.id)}
                    disabled={!!loadingId}
                  >
                    {loadingId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                    Terminer
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

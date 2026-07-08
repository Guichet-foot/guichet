"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateMatchStatus, toggleMatchVente, deleteMatch } from "@/lib/actions/match-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, ShoppingCart, ShoppingCartIcon, CheckCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface MatchActionButtonsProps {
  matchId: string;
  zoneId: string;
  status: string;
  venteActive: boolean;
  homeTeam?: string;
  awayTeam?: string;
}

export function MatchActionButtons({ matchId, zoneId: _zoneId, status, venteActive, homeTeam, awayTeam }: MatchActionButtonsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");

  async function handleToggleVente() {
    setLoading("vente");
    const result = await toggleMatchVente(matchId, !venteActive);
    if (result.error) toast.error(result.error);
    else toast.success(venteActive ? "Vente fermée" : "Vente ouverte !");
    setLoading(null);
  }

  function handleTerminerClick() {
    setHomeScore("");
    setAwayScore("");
    setScoreOpen(true);
  }

  async function handleSaveScore() {
    if (homeScore === "" || awayScore === "") {
      toast.error("Entrez les deux scores");
      return;
    }
    setLoading("terminer");
    const result = await updateMatchStatus(matchId, "termine", {
      homeScore: parseInt(homeScore),
      awayScore: parseInt(awayScore),
    });
    if (result.error) {
      toast.error(result.error);
      setLoading(null);
      return;
    }
    toast.success(`Match terminé : ${homeScore} - ${awayScore}`);
    setScoreOpen(false);
    setLoading(null);
  }

  async function handleDelete() {
    setLoading("delete");
    const result = await deleteMatch(matchId);
    setLoading(null);
    if (result.error) {
      toast.error(result.error);
      setDeleteOpen(false);
      return;
    }
    toast.success("Match supprimé");
    setDeleteOpen(false);
    router.refresh();
  }

  return (
    <>
      <div className="flex gap-1">
        {status !== "termine" && status !== "annule" && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleToggleVente}
              disabled={loading === "vente"}
              className={venteActive ? "text-danger border-danger" : "text-brand border-brand"}
              title={venteActive ? "Arrêter la vente" : "Démarrer la vente"}
            >
              {loading === "vente" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : venteActive ? (
                <><ShoppingCartIcon className="h-3 w-3 mr-1" />Arrêter</>
              ) : (
                <><ShoppingCart className="h-3 w-3 mr-1" />Démarrer</>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTerminerClick}
              disabled={loading === "terminer"}
              className="text-muted-foreground"
              title="Terminer le match"
            >
              {loading === "terminer" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <><CheckCircle className="h-3 w-3 mr-1" />Terminer</>
              )}
            </Button>
          </>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setDeleteOpen(true)}
          disabled={loading === "delete"}
          className="text-danger hover:text-danger hover:bg-danger/10"
          title="Supprimer le match"
        >
          {loading === "delete" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Trash2 className="h-3 w-3" />
          )}
        </Button>
      </div>

      {/* Modal score */}
      <Dialog open={scoreOpen} onOpenChange={setScoreOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Score du match</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-center gap-4">
              <div className="text-center flex-1">
                <p className="font-semibold text-sm mb-2">{homeTeam || "Domicile"}</p>
                <Input type="number" min="0" value={homeScore} onChange={(e) => setHomeScore(e.target.value)} className="text-center text-2xl font-bold h-14" placeholder="0" autoFocus />
              </div>
              <span className="text-2xl font-bold text-muted-foreground mt-6">-</span>
              <div className="text-center flex-1">
                <p className="font-semibold text-sm mb-2">{awayTeam || "Visiteur"}</p>
                <Input type="number" min="0" value={awayScore} onChange={(e) => setAwayScore(e.target.value)} className="text-center text-2xl font-bold h-14" placeholder="0" />
              </div>
            </div>
            <Button type="button" onClick={handleSaveScore} disabled={loading === "terminer"} className="w-full h-12 bg-brand hover:bg-brand/90">
              {loading === "terminer" ? <Loader2 className="h-5 w-5 animate-spin" /> : "Enregistrer et terminer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal suppression */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-danger">
              <Trash2 className="h-5 w-5" />
              Supprimer le match ?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Vous êtes sur le point de supprimer <strong>{homeTeam} vs {awayTeam}</strong>. Cette action est irréversible.
            </p>
            <p className="text-xs text-muted-foreground bg-muted rounded-lg p-3">
              La suppression est bloquée si des billets ont déjà été émis pour ce match.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteOpen(false)} disabled={loading === "delete"}>
                Annuler
              </Button>
              <Button className="flex-1 bg-danger hover:bg-danger/90 text-white" onClick={handleDelete} disabled={loading === "delete"}>
                {loading === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Supprimer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

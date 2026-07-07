"use client";

import { useState } from "react";
import { updateMatchStatus, toggleMatchVente } from "@/lib/actions/match-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, ShoppingCart, ShoppingCartIcon, CheckCircle } from "lucide-react";
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
  const [loading, setLoading] = useState<string | null>(null);
  const [scoreOpen, setScoreOpen] = useState(false);
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

  if (status === "termine" || status === "annule") return null;

  return (
    <>
      <div className="flex gap-1">
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
            <>
              <ShoppingCartIcon className="h-3 w-3 mr-1" />
              Arrêter
            </>
          ) : (
            <>
              <ShoppingCart className="h-3 w-3 mr-1" />
              Démarrer
            </>
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
            <>
              <CheckCircle className="h-3 w-3 mr-1" />
              Terminer
            </>
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
                <Input
                  type="number"
                  min="0"
                  value={homeScore}
                  onChange={(e) => setHomeScore(e.target.value)}
                  className="text-center text-2xl font-bold h-14"
                  placeholder="0"
                  autoFocus
                />
              </div>
              <span className="text-2xl font-bold text-muted-foreground mt-6">-</span>
              <div className="text-center flex-1">
                <p className="font-semibold text-sm mb-2">{awayTeam || "Visiteur"}</p>
                <Input
                  type="number"
                  min="0"
                  value={awayScore}
                  onChange={(e) => setAwayScore(e.target.value)}
                  className="text-center text-2xl font-bold h-14"
                  placeholder="0"
                />
              </div>
            </div>
            <Button
              type="button"
              onClick={handleSaveScore}
              disabled={loading === "terminer"}
              className="w-full h-12 bg-brand hover:bg-brand/90"
            >
              {loading === "terminer" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Enregistrer et terminer"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useState } from "react";
import { updateMatchResult, deleteTournamentMatch } from "@/lib/actions/tournament-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface MatchResultActionsProps {
  matchId: string;
  tournamentId: string;
  homeTeamName: string;
  awayTeamName: string;
  status: string;
  currentHomeScore: number | null;
  currentAwayScore: number | null;
}

export function MatchResultActions({
  matchId,
  tournamentId,
  homeTeamName,
  awayTeamName,
  status,
  currentHomeScore,
  currentAwayScore,
}: MatchResultActionsProps) {
  const [scoreOpen, setScoreOpen] = useState(false);
  const [homeScore, setHomeScore] = useState(currentHomeScore?.toString() || "");
  const [awayScore, setAwayScore] = useState(currentAwayScore?.toString() || "");
  const [loading, setLoading] = useState(false);

  async function handleSaveResult() {
    if (homeScore === "" || awayScore === "") {
      toast.error("Entrez les deux scores");
      return;
    }
    setLoading(true);
    const result = await updateMatchResult(
      matchId,
      parseInt(homeScore),
      parseInt(awayScore),
      tournamentId
    );
    if (result.error) toast.error(result.error);
    else {
      toast.success("Résultat enregistré");
      setScoreOpen(false);
    }
    setLoading(false);
  }

  async function handleDelete() {
    if (!confirm("Supprimer ce match ?")) return;
    setLoading(true);
    const result = await deleteTournamentMatch(matchId, tournamentId);
    if (result.error) toast.error(result.error);
    else toast.success("Match supprimé");
    setLoading(false);
  }

  return (
    <>
      <div className="flex gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setHomeScore(currentHomeScore?.toString() || "");
            setAwayScore(currentAwayScore?.toString() || "");
            setScoreOpen(true);
          }}
          className="h-6 w-6 p-0"
          title={status === "termine" ? "Modifier le score" : "Ajouter le score"}
        >
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={loading}
          className="h-6 w-6 p-0 text-danger"
          title="Supprimer"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
        </Button>
      </div>

      <Dialog open={scoreOpen} onOpenChange={setScoreOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Score du match</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-center gap-4">
              <div className="text-center flex-1">
                <p className="font-semibold text-sm mb-2">{homeTeamName}</p>
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
                <p className="font-semibold text-sm mb-2">{awayTeamName}</p>
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
              onClick={handleSaveResult}
              disabled={loading}
              className="w-full h-12 bg-brand hover:bg-brand/90"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Enregistrer le résultat"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

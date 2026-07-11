"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateMatchStatus, deleteMatch } from "@/lib/actions/match-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  CheckCircle,
  MoreVertical,
  Eye,
  Pencil,
  Calendar,
  MapPin,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateShort } from "@/lib/format";
import { MATCH_STATUS_LABELS, MATCH_STATUS_COLORS } from "@/lib/constants";
import Link from "next/link";

interface MatchMobileActionsProps {
  match: {
    id: string;
    zone_id: string;
    home_team: string;
    away_team: string;
    venue: string;
    match_date: string;
    status: string;
    vente_active?: boolean;
    home_score: number | null;
    away_score: number | null;
  };
  detailUrl: string;
  editUrl?: string;
}

export function MatchMobileActions({ match, detailUrl, editUrl }: MatchMobileActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");

  async function handleTerminer() {
    setOpen(false);
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
    const result = await updateMatchStatus(match.id, "termine", {
      homeScore: parseInt(homeScore),
      awayScore: parseInt(awayScore),
    });
    if (result.error) toast.error(result.error);
    else toast.success(`Match terminé : ${homeScore} - ${awayScore}`);
    setScoreOpen(false);
    setLoading(null);
  }

  async function handleDelete() {
    setLoading("delete");
    const result = await deleteMatch(match.id);
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

  const isFinished = match.status === "termine" || match.status === "annule";

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)} className="h-8 w-8 p-0">
        <MoreVertical className="h-4 w-4" />
      </Button>

      {/* Menu actions */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-left">
              {match.home_team} vs {match.away_team}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {formatDateShort(match.match_date)}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {match.venue}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className={MATCH_STATUS_COLORS[match.status]}>
                  {MATCH_STATUS_LABELS[match.status]}
                </Badge>
                {match.status === "termine" && match.home_score !== null && (
                  <span className="inline-block bg-brand text-white text-xs font-bold px-2 py-0.5 rounded">
                    {match.home_score} - {match.away_score}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {!isFinished && (
                <Button type="button" variant="outline" onClick={handleTerminer} className="w-full justify-start">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Terminer le match
                </Button>
              )}
              {editUrl && !isFinished && (
                <Link href={editUrl} onClick={() => setOpen(false)}>
                  <Button variant="outline" className="w-full justify-start">
                    <Pencil className="h-4 w-4 mr-2" />
                    Modifier le match
                  </Button>
                </Link>
              )}
              <Link href={detailUrl} onClick={() => setOpen(false)}>
                <Button variant="outline" className="w-full justify-start">
                  <Eye className="h-4 w-4 mr-2" />
                  Voir les détails
                </Button>
              </Link>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setOpen(false); setDeleteOpen(true); }}
                className="w-full justify-start text-danger border-danger hover:bg-danger/10"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer le match
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Score dialog */}
      <Dialog open={scoreOpen} onOpenChange={setScoreOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Score du match</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-center gap-4">
              <div className="text-center flex-1">
                <p className="font-semibold text-sm mb-2">{match.home_team}</p>
                <Input type="number" min="0" value={homeScore} onChange={(e) => setHomeScore(e.target.value)} className="text-center text-2xl font-bold h-14" placeholder="0" autoFocus />
              </div>
              <span className="text-2xl font-bold text-muted-foreground mt-6">-</span>
              <div className="text-center flex-1">
                <p className="font-semibold text-sm mb-2">{match.away_team}</p>
                <Input type="number" min="0" value={awayScore} onChange={(e) => setAwayScore(e.target.value)} className="text-center text-2xl font-bold h-14" placeholder="0" />
              </div>
            </div>
            <Button type="button" onClick={handleSaveScore} disabled={loading === "terminer"} className="w-full h-12 bg-brand hover:bg-brand/90">
              {loading === "terminer" ? <Loader2 className="h-5 w-5 animate-spin" /> : "Enregistrer et terminer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Suppression dialog */}
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
              Vous êtes sur le point de supprimer <strong>{match.home_team} vs {match.away_team}</strong>. Cette action est irréversible.
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

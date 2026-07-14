"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateMatchStatus, deleteMatch } from "@/lib/actions/match-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, CheckCircle, Trash2, Pencil, PlayCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface MatchActionButtonsProps {
  matchId: string;
  zoneId: string | null;
  status: string;
  venteActive?: boolean;
  homeTeam?: string;
  awayTeam?: string;
}

export function MatchActionButtons({ matchId, zoneId, status, homeTeam, awayTeam }: MatchActionButtonsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function handleTerminerClick() {
    setLoading("terminer");
    const result = await updateMatchStatus(matchId, "termine");
    setLoading(null);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Match terminé");
    router.refresh();
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

  async function handleDemarrer() {
    setLoading("demarrer");
    const result = await updateMatchStatus(matchId, "en_cours");
    setLoading(null);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Match démarré");
    router.refresh();
  }

  return (
    <>
      <div className="flex gap-1">
        <Link href={`/matchs/${matchId}/modifier`}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            title="Modifier le match"
            className="text-muted-foreground hover:text-foreground"
          >
            <Pencil className="h-3 w-3" />
          </Button>
        </Link>
        {zoneId === null && status === "programme" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDemarrer}
            disabled={loading === "demarrer"}
            className="text-green-700 border-green-600 hover:bg-green-50"
            title="Démarrer le match"
          >
            {loading === "demarrer" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <><PlayCircle className="h-3 w-3 mr-1" />Démarrer</>
            )}
          </Button>
        )}
        {status !== "termine" && status !== "annule" && (
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
              La suppression est bloquée uniquement si le match est en cours.
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

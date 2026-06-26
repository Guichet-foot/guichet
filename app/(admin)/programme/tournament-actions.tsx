"use client";

import { useState } from "react";
import { updateTournamentStatus } from "@/lib/actions/tournament-actions";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface TournamentActionsProps {
  tournamentId: string;
  status: string;
}

export function TournamentActions({ tournamentId, status }: TournamentActionsProps) {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleToggleStatus() {
    const newStatus = status === "en_cours" ? "termine" : "en_cours";
    setLoading("status");
    const result = await updateTournamentStatus(tournamentId, newStatus);
    if (result.error) toast.error(result.error);
    else toast.success(newStatus === "termine" ? "Tournoi terminé" : "Tournoi relancé");
    setLoading(null);
  }

  async function handleDelete() {
    if (!confirm("Supprimer ce tournoi et tous ses matchs ? Cette action est irréversible.")) return;
    setLoading("delete");
    const supabase = createClient();
    const { error } = await supabase
      .from("tournaments")
      .delete()
      .eq("id", tournamentId);
    if (error) toast.error(error.message);
    else {
      toast.success("Tournoi supprimé");
      window.location.reload();
    }
    setLoading(null);
  }

  return (
    <div className="flex gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleToggleStatus}
        disabled={loading === "status"}
        className={status === "en_cours" ? "text-muted-foreground" : "text-brand border-brand"}
        title={status === "en_cours" ? "Terminer le tournoi" : "Relancer le tournoi"}
      >
        {loading === "status" ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : status === "en_cours" ? (
          <>
            <CheckCircle className="h-3 w-3 mr-1" />
            Terminer
          </>
        ) : (
          <>
            <Play className="h-3 w-3 mr-1" />
            Relancer
          </>
        )}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleDelete}
        disabled={loading === "delete"}
        className="text-danger"
        title="Supprimer"
      >
        {loading === "delete" ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Trash2 className="h-3 w-3" />
        )}
      </Button>
    </div>
  );
}

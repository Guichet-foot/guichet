"use client";

import { useState } from "react";
import { updateMatchStatus } from "@/lib/actions/match-actions";
import { toggleMatchVente } from "@/lib/actions/match-actions";
import { Button } from "@/components/ui/button";
import { Loader2, ShoppingCart, ShoppingCartIcon, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface MatchActionButtonsProps {
  matchId: string;
  status: string;
  venteActive: boolean;
}

export function MatchActionButtons({ matchId, status, venteActive }: MatchActionButtonsProps) {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleToggleVente() {
    setLoading("vente");
    const result = await toggleMatchVente(matchId, !venteActive);
    if (result.error) toast.error(result.error);
    else toast.success(venteActive ? "Vente arrêtée" : "Vente ouverte");
    setLoading(null);
  }

  async function handleTerminer() {
    if (!confirm("Terminer ce match ? Les caissiers ne pourront plus vendre de billets.")) return;
    setLoading("terminer");
    const result = await updateMatchStatus(matchId, "termine");
    if (result.error) toast.error(result.error);
    else toast.success("Match terminé");
    setLoading(null);
  }

  if (status === "termine" || status === "annule") return null;

  return (
    <div className="flex gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleToggleVente}
        disabled={loading === "vente"}
        className={venteActive ? "text-danger border-danger" : "text-brand border-brand"}
        title={venteActive ? "Arrêter la vente" : "Ouvrir la vente"}
      >
        {loading === "vente" ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : venteActive ? (
          <>
            <ShoppingCartIcon className="h-3 w-3 mr-1" />
            Fermer vente
          </>
        ) : (
          <>
            <ShoppingCart className="h-3 w-3 mr-1" />
            Ouvrir vente
          </>
        )}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleTerminer}
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
  );
}

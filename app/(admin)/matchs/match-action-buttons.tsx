"use client";

import { useState } from "react";
import { updateMatchStatus, toggleMatchVente } from "@/lib/actions/match-actions";
import { checkZonePaymentById, initiatePaytechPaymentForZone } from "@/lib/actions/payment-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, ShoppingCart, ShoppingCartIcon, CheckCircle, Lock, CreditCard } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface MatchActionButtonsProps {
  matchId: string;
  zoneId: string;
  status: string;
  venteActive: boolean;
  homeTeam?: string;
  awayTeam?: string;
}

function formatFCFA(n: number) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FCFA";
}

export function MatchActionButtons({ matchId, zoneId, status, venteActive, homeTeam, awayTeam }: MatchActionButtonsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paying, setPaying] = useState(false);
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");

  async function handleToggleVente() {
    if (venteActive) {
      // Fermer la vente directement
      setLoading("vente");
      const result = await toggleMatchVente(matchId, false);
      if (result.error) toast.error(result.error);
      else toast.success("Vente fermée");
      setLoading(null);
      return;
    }

    // Ouvrir la vente — vérifier le paiement pour cette zone
    setLoading("vente");
    const payStatus = await checkZonePaymentById(zoneId);
    setLoading(null);

    if (payStatus.isPaid) {
      // Paiement OK → ouvrir directement
      setLoading("vente");
      const result = await toggleMatchVente(matchId, true);
      if (result.error) toast.error(result.error);
      else toast.success("Vente ouverte !");
      setLoading(null);
    } else {
      // Paiement requis → afficher le modal
      setPaymentAmount(payStatus.amount);
      setPaymentOpen(true);
    }
  }

  async function handlePayNow() {
    setPaying(true);
    const result = await initiatePaytechPaymentForZone(zoneId);
    if (result.error) {
      toast.error(result.error);
      setPaying(false);
      return;
    }
    if (result.redirectUrl) {
      window.location.href = result.redirectUrl;
    }
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
          title={venteActive ? "Fermer la vente" : "Ouvrir la vente"}
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

      {/* Modal paiement requis */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex justify-center mb-2">
              <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
                <Lock className="h-7 w-7 text-amber-600" />
              </div>
            </div>
            <DialogTitle className="text-center">Billetterie non activée</DialogTitle>
            <DialogDescription className="text-center">
              Pour ouvrir la vente, activez d&apos;abord la billetterie du jour.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide mb-1">Frais journaliers</p>
              <p className="text-3xl font-bold text-amber-700">{formatFCFA(paymentAmount)}</p>
              <p className="text-xs text-amber-600 mt-1">Valable 24h · Débloque caisse + scanner</p>
            </div>
            <Button
              onClick={handlePayNow}
              disabled={paying}
              className="w-full h-11 bg-amber-600 hover:bg-amber-700 text-white font-semibold"
            >
              {paying ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Redirection…</>
              ) : (
                <><CreditCard className="h-4 w-4 mr-2" />Payer avec Paytech</>
              )}
            </Button>
            <Link href="/abonnements" className="block">
              <Button variant="outline" className="w-full h-9 text-sm" onClick={() => setPaymentOpen(false)}>
                Voir les abonnements
              </Button>
            </Link>
          </div>
        </DialogContent>
      </Dialog>

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

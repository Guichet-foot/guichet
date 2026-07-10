"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye, Printer, CheckCircle, AlertCircle, Wallet, TrendingUp, Building2 } from "lucide-react";
import { formatFCFA } from "@/lib/format";

export interface MatchStats {
  printed: number;
  validated: number;
  printedRevenue: number;
  validatedRevenue: number;
}

interface Props {
  matchName: string;
  stats: MatchStats;
}

export function MatchApercuDialog({ matchName, stats }: Props) {
  const [open, setOpen] = useState(false);

  const invendus = Math.max(0, stats.printed - stats.validated);
  const platformRevenue = stats.printed * 10;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        title="Aperçu du match"
        className="h-7 w-7 p-0"
      >
        <Eye className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-brand" />
              Aperçu du match
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm font-medium -mt-2">{matchName}</p>

          {/* Billets — 3 tuiles */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-muted/60 p-3 text-center">
              <Printer className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xl font-bold">{stats.printed.toLocaleString("fr-FR")}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">Imprimés</p>
            </div>
            <div className="rounded-xl bg-success/10 p-3 text-center">
              <CheckCircle className="h-4 w-4 mx-auto mb-1 text-success" />
              <p className="text-xl font-bold text-success">{stats.validated.toLocaleString("fr-FR")}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">Validés</p>
            </div>
            <div className="rounded-xl bg-orange-500/10 p-3 text-center">
              <AlertCircle className="h-4 w-4 mx-auto mb-1 text-orange-500" />
              <p className="text-xl font-bold text-orange-500">{invendus.toLocaleString("fr-FR")}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">Invendus</p>
            </div>
          </div>

          {/* Financier */}
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-xl border px-4 py-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium">Recettes</p>
                  <p className="text-[10px] text-muted-foreground">{stats.printed} billets imprimés</p>
                </div>
              </div>
              <p className="font-bold tabular-nums">{formatFCFA(stats.printedRevenue)}</p>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-success/10 border border-success/20 px-4 py-3">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-success shrink-0" />
                <div>
                  <p className="text-sm font-medium text-success">Solde Net</p>
                  <p className="text-[10px] text-muted-foreground">{stats.validated} billets validés</p>
                </div>
              </div>
              <p className="font-bold text-success tabular-nums">{formatFCFA(stats.validatedRevenue)}</p>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-brand/5 border border-brand/20 px-4 py-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-brand shrink-0" />
                <div>
                  <p className="text-sm font-medium text-brand">Revenus Plateforme</p>
                  <p className="text-[10px] text-muted-foreground">{stats.printed} × 10 FCFA</p>
                </div>
              </div>
              <p className="font-bold text-brand tabular-nums">{formatFCFA(platformRevenue)}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

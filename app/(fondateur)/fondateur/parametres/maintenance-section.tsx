"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { detectDuplicateBilleterieScans, fixDuplicateBilleterieScans } from "@/lib/actions/fondateur-actions";

export function MaintenanceSection() {
  const [detecting, setDetecting] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [detected, setDetected] = useState<{ duplicateTickets: number; extraScans: number } | null>(null);
  const [fixResult, setFixResult] = useState<{ fixed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDetect() {
    setDetecting(true);
    setDetected(null);
    setFixResult(null);
    setError(null);
    const result = await detectDuplicateBilleterieScans();
    setDetecting(false);
    if (result.error) { setError(result.error); return; }
    setDetected({ duplicateTickets: result.duplicateTickets ?? 0, extraScans: result.extraScans ?? 0 });
  }

  async function handleFix() {
    setFixing(true);
    setError(null);
    const result = await fixDuplicateBilleterieScans();
    setFixing(false);
    if (result.error) { setError(result.error); return; }
    setFixResult({ fixed: result.fixed ?? 0 });
    setDetected(null);
  }

  const hasDuplicates = detected && detected.extraScans > 0;

  return (
    <Card className="border-red-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-red-700">
          <ShieldAlert className="h-4 w-4" />
          Maintenance données
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Détecte et supprime les scans de billets billetterie enregistrés en double
          (bug corrigé — un billet ne peut plus être scanné qu&apos;une seule fois).
        </p>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {detected && (
          <div className={`rounded-lg border px-4 py-3 text-sm ${hasDuplicates ? "bg-orange-50 border-orange-200" : "bg-green-50 border-green-200"}`}>
            {hasDuplicates ? (
              <div className="flex items-start gap-2 text-orange-800">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">{detected.duplicateTickets} billet{detected.duplicateTickets > 1 ? "s" : ""} scanné{detected.duplicateTickets > 1 ? "s" : ""} en double</p>
                  <p className="text-orange-700 mt-0.5">{detected.extraScans} scan{detected.extraScans > 1 ? "s" : ""} parasite{detected.extraScans > 1 ? "s" : ""} à supprimer — seul le 1er scan par billet sera conservé</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <p>Aucun doublon détecté — les données sont propres.</p>
              </div>
            )}
          </div>
        )}

        {fixResult && (
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 shrink-0" />
            {fixResult.fixed === 0
              ? "Aucun doublon trouvé — rien à corriger."
              : `${fixResult.fixed} scan${fixResult.fixed > 1 ? "s" : ""} parasite${fixResult.fixed > 1 ? "s" : ""} supprimé${fixResult.fixed > 1 ? "s" : ""}. Les stats sont maintenant correctes.`}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={handleDetect}
            disabled={detecting || fixing}
            className="border-orange-300 text-orange-700 hover:bg-orange-50"
          >
            {detecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <AlertTriangle className="h-4 w-4 mr-2" />}
            Détecter les doublons
          </Button>

          {hasDuplicates && !fixResult && (
            <Button
              onClick={handleFix}
              disabled={fixing}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {fixing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldAlert className="h-4 w-4 mr-2" />}
              Corriger {detected.extraScans} scan{detected.extraScans > 1 ? "s" : ""} parasite{detected.extraScans > 1 ? "s" : ""}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

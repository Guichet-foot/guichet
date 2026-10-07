"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Hash, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import {
  detectDuplicateBilleterieSerials,
  fixDuplicateBilleterieSerials,
  type DuplicateSerialGroup,
} from "@/lib/actions/fondateur-actions";

export function SerialMaintenanceSection() {
  const [detecting, setDetecting] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [detected, setDetected] = useState<{ groups: DuplicateSerialGroup[]; total: number } | null>(null);
  const [fixResult, setFixResult] = useState<{ fixed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDetect() {
    setDetecting(true);
    setDetected(null);
    setFixResult(null);
    setError(null);
    const result = await detectDuplicateBilleterieSerials();
    setDetecting(false);
    if (result.error) { setError(result.error); return; }
    setDetected({ groups: result.groups ?? [], total: result.totalDuplicateTickets ?? 0 });
  }

  async function handleFix() {
    setFixing(true);
    setError(null);
    const result = await fixDuplicateBilleterieSerials();
    setFixing(false);
    if (result.error) { setError(result.error); return; }
    setFixResult({ fixed: result.fixed ?? 0 });
    setDetected(null);
  }

  const hasDuplicates = detected && detected.groups.length > 0;

  return (
    <Card className="border-red-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-red-700">
          <Hash className="h-4 w-4" />
          Numéros de série en double
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Détecte les billets imprimés avec le même numéro de série (bug corrigé — la numérotation
          est maintenant atomique). Le QR code de chaque billet reste unique dans tous les cas, le
          scan n&apos;est jamais affecté. La correction attribue un nouveau numéro en base aux billets
          en double (garde le plus ancien) ; elle ne change pas ce qui est déjà imprimé sur papier.
        </p>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {detected && (
          <div className={`rounded-lg border px-4 py-3 text-sm ${hasDuplicates ? "bg-orange-50 border-orange-200" : "bg-green-50 border-green-200"}`}>
            {hasDuplicates ? (
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-orange-800">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">
                      {detected.groups.length} numéro{detected.groups.length > 1 ? "s" : ""} de série en double
                      {" "}— {detected.total} billet{detected.total > 1 ? "s" : ""} à renuméroter
                    </p>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1 pl-6">
                  {detected.groups.map((g) => (
                    <div key={g.serialNumber} className="text-xs text-orange-700">
                      <span className="font-mono font-medium">{g.serialNumber}</span>
                      {" — "}{g.count}× ({g.billeterieNames.join(", ")})
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <p>Aucun doublon détecté — les numéros de série sont uniques.</p>
              </div>
            )}
          </div>
        )}

        {fixResult && (
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 shrink-0" />
            {fixResult.fixed === 0
              ? "Aucun doublon trouvé — rien à corriger."
              : `${fixResult.fixed} billet${fixResult.fixed > 1 ? "s" : ""} renuméroté${fixResult.fixed > 1 ? "s" : ""}.`}
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
              {fixing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Hash className="h-4 w-4 mr-2" />}
              Renuméroter {detected.total} billet{detected.total > 1 ? "s" : ""}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

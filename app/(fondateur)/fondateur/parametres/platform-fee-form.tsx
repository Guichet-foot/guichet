"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { updatePlatformFee } from "@/lib/actions/platform-actions";

export function PlatformFeeForm({ currentFee }: { currentFee: number }) {
  const [fee, setFee] = useState(String(currentFee));
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    const amount = parseInt(fee);
    if (isNaN(amount) || amount < 0) { toast.error("Montant invalide"); return; }
    setLoading(true);
    const result = await updatePlatformFee(amount, effectiveDate) as { error?: string; success?: boolean };
    if (result.error) toast.error(result.error);
    else toast.success("Frais mis à jour — les bilans antérieurs gardent l'ancien montant");
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Modifier les frais de plateforme</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nouveau montant (FCFA / jour)</Label>
            <Input type="number" min="0" step="500" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="5000" />
          </div>
          <div className="space-y-2">
            <Label>Date d&apos;entrée en vigueur</Label>
            <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Les bilans générés pour des dates antérieures garderont l&apos;ancien montant. La commission ODCAV reste fixe à 5%.
        </p>
        <Button type="button" onClick={handleSave} disabled={loading} className="bg-amber-600 hover:bg-amber-700">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Enregistrer
        </Button>
      </CardContent>
    </Card>
  );
}

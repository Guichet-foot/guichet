"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Layers } from "lucide-react";
import { toast } from "sonner";
import { updatePlatformFee } from "@/lib/actions/platform-actions";

const BLOC_OPTIONS = [
  { value: 1000, label: "1 000 FCFA / bloc", sublabel: "= 10 FCFA par billet" },
  { value: 800, label: "800 FCFA / bloc", sublabel: "= 8 FCFA par billet" },
];

export function PlatformFeeForm({ currentFeePerBlock }: { currentFeePerBlock: number }) {
  const [selected, setSelected] = useState<number>(currentFeePerBlock === 800 ? 800 : 1000);
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    const result = await updatePlatformFee(selected, effectiveDate) as { error?: string; success?: boolean };
    if (result.error) toast.error(result.error);
    else toast.success("Tarif par bloc mis à jour");
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="h-4 w-4" />
          Modifier le tarif de facturation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          <Label>Tarif par bloc (100 billets)</Label>
          <div className="grid grid-cols-2 gap-3">
            {BLOC_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelected(opt.value)}
                className={`rounded-xl border-2 p-4 text-left transition-all ${
                  selected === opt.value
                    ? "border-amber-500 bg-amber-50 text-amber-900 shadow-sm ring-2 ring-offset-1 ring-amber-400"
                    : "border-border bg-background hover:border-muted-foreground/40"
                }`}
              >
                <p className="text-base font-bold">{opt.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{opt.sublabel}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Date d&apos;entrée en vigueur</Label>
          <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
        </div>

        <p className="text-xs text-muted-foreground">
          1 bloc = 100 billets vendus. Les frais sont calculés automatiquement dans les rapports financiers.
        </p>

        <Button type="button" onClick={handleSave} disabled={loading} className="bg-amber-600 hover:bg-amber-700">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Enregistrer
        </Button>
      </CardContent>
    </Card>
  );
}

"use client";

import { useState, useMemo } from "react";
import { manualActivateZone } from "@/lib/actions/payment-actions";
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
import { Loader2, Banknote, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface ManualActivationModalProps {
  zones: { id: string; name: string }[];
  defaultAmount: number;
  open: boolean;
  onClose: () => void;
}

const DURATION_PRESETS = [
  { label: "24h", hours: 24 },
  { label: "48h", hours: 48 },
  { label: "72h", hours: 72 },
];

function formatFCFA(n: number) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FCFA";
}

function formatExpiry(hours: number): string {
  const d = new Date(Date.now() + hours * 3600 * 1000);
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }) + " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function ManualActivationModal({
  zones,
  defaultAmount,
  open,
  onClose,
}: ManualActivationModalProps) {
  const router = useRouter();
  const [zoneId, setZoneId] = useState("");
  const [amount, setAmount] = useState(String(defaultAmount));
  const [durationPreset, setDurationPreset] = useState<number>(24);
  const [customHours, setCustomHours] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const effectiveHours = useCustom
    ? Math.max(1, parseInt(customHours) || 0)
    : durationPreset;

  const amountNum = parseInt(amount) || 0;
  const isValid = zoneId && amountNum > 0 && effectiveHours > 0;

  const expiryLabel = useMemo(
    () => (effectiveHours > 0 ? formatExpiry(effectiveHours) : "—"),
    [effectiveHours]
  );

  async function handleSubmit() {
    if (!isValid) return;
    setLoading(true);
    const result = await manualActivateZone(zoneId, amountNum, effectiveHours);
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setDone(true);
    router.refresh();
    setTimeout(() => {
      setDone(false);
      handleClose();
    }, 2000);
  }

  function handleClose() {
    setZoneId("");
    setAmount(String(defaultAmount));
    setDurationPreset(24);
    setCustomHours("");
    setUseCustom(false);
    setDone(false);
    onClose();
  }

  const selectedZone = zones.find((z) => z.id === zoneId);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <Banknote className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <DialogTitle>Activation manuelle</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Ouvrir la billetterie d&apos;une zone sans paiement Paytech
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {done ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <p className="font-semibold text-green-800">Billetterie activée !</p>
            <p className="text-sm text-muted-foreground text-center">
              Zone <strong>{selectedZone?.name}</strong> activée jusqu&apos;au {expiryLabel}
            </p>
          </div>
        ) : (
          <div className="space-y-5 pt-1">
            {/* Zone */}
            <div className="space-y-1.5">
              <Label>Zone *</Label>
              <select
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">Sélectionner une zone…</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>{z.name}</option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <Label>Montant perçu *</Label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pr-16 h-10"
                  placeholder={String(defaultAmount)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  FCFA
                </span>
              </div>
              {amountNum !== defaultAmount && amountNum > 0 && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Frais plateforme standard : {formatFCFA(defaultAmount)}
                </p>
              )}
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label>Durée d&apos;activation *</Label>
              <div className="flex flex-wrap gap-2">
                {DURATION_PRESETS.map((p) => (
                  <Button
                    key={p.hours}
                    type="button"
                    variant={!useCustom && durationPreset === p.hours ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setDurationPreset(p.hours); setUseCustom(false); }}
                    className={
                      !useCustom && durationPreset === p.hours
                        ? "bg-amber-600 hover:bg-amber-700 text-white h-9"
                        : "h-9"
                    }
                  >
                    {p.label}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant={useCustom ? "default" : "outline"}
                  size="sm"
                  onClick={() => setUseCustom(true)}
                  className={useCustom ? "bg-amber-600 hover:bg-amber-700 text-white h-9" : "h-9"}
                >
                  Personnalisé
                </Button>
              </div>
              {useCustom && (
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    type="number"
                    min="1"
                    max="720"
                    value={customHours}
                    onChange={(e) => setCustomHours(e.target.value)}
                    className="w-28 h-9"
                    placeholder="ex : 36"
                    autoFocus
                  />
                  <span className="text-sm text-muted-foreground">heures</span>
                </div>
              )}
            </div>

            {/* Expiry preview */}
            {effectiveHours > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
                <Clock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-0.5">
                    Expiration
                  </p>
                  <p className="text-sm text-amber-700">{expiryLabel}</p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    {effectiveHours}h · {amountNum > 0 ? formatFCFA(amountNum) : "—"} · Espèces
                  </p>
                </div>
              </div>
            )}

            <Button
              onClick={handleSubmit}
              disabled={!isValid || loading}
              className="w-full h-11 bg-amber-600 hover:bg-amber-700 text-white font-semibold"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Activation en cours…</>
              ) : (
                <><Banknote className="h-4 w-4 mr-2" />Activer la billetterie</>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

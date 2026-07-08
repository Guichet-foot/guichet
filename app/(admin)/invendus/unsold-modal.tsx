"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, PackageX, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { formatFCFA, formatDateShort } from "@/lib/format";
import {
  getMatchCategoriesForUnsold,
  getMatchesForReassignment,
  declareUnsoldByCategory,
  reassignTicketsToMatch,
} from "@/lib/actions/invendus-actions";
import { useRouter } from "next/navigation";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface CategoryInfo {
  id: string;
  name: string;
  price: number;
  vendu_count: number;
  scanne_count: number;
  annule_count: number;
}

interface MatchOption {
  id: string;
  home_team: string;
  away_team: string;
  match_date: string;
}

interface Props {
  matchId: string;
  matchName: string;
  open: boolean;
  onClose: () => void;
}

export function UnsoldModal({ matchId, matchName, open, onClose }: Props) {
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [availableMatches, setAvailableMatches] = useState<MatchOption[]>([]);
  const [unsoldCounts, setUnsoldCounts] = useState<Record<string, string>>({});
  const [reassignMatchId, setReassignMatchId] = useState("");
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReassignMatchId("");
    async function load() {
      setLoadingData(true);
      const [cats, matches] = await Promise.all([
        getMatchCategoriesForUnsold(matchId),
        getMatchesForReassignment(matchId),
      ]);
      setCategories(cats);
      setAvailableMatches(matches);
      const initial: Record<string, string> = {};
      cats.forEach((c) => {
        initial[c.id] = c.annule_count > 0 ? String(c.annule_count) : "";
      });
      setUnsoldCounts(initial);
      setLoadingData(false);
    }
    load();
  }, [open, matchId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const categoryUnsolds = categories.map((c) => ({
      categoryId: c.id,
      count: Math.max(0, parseInt(unsoldCounts[c.id] || "0") || 0),
    }));

    const result = await declareUnsoldByCategory(matchId, categoryUnsolds);
    if (result.error) {
      toast.error(result.error);
      setSaving(false);
      return;
    }

    const total = result.totalUnsold ?? 0;

    if (reassignMatchId) {
      const reassignResult = await reassignTicketsToMatch(matchId, reassignMatchId);
      if (reassignResult.error) {
        toast.error(reassignResult.error);
        setSaving(false);
        return;
      }
      const dest = availableMatches.find((m) => m.id === reassignMatchId);
      const destName = dest ? `${dest.home_team} vs ${dest.away_team}` : "";
      const unsoldMsg = total > 0 ? `${total} invendu(s) enregistré(s)` : "Aucun invendu";
      toast.success(`${unsoldMsg} · ${reassignResult.count} billet(s) transférés vers ${destName}`);
    } else {
      toast.success(total > 0 ? `${total} billet(s) déclarés invendus` : "Tous les billets déclarés vendus");
    }

    router.refresh();
    onClose();
  }

  const totalUnsold = categories.reduce(
    (sum, c) => sum + (parseInt(unsoldCounts[c.id] || "0") || 0),
    0
  );
  const totalDeduction = categories.reduce((sum, c) => {
    const count = parseInt(unsoldCounts[c.id] || "0") || 0;
    return sum + count * c.price;
  }, 0);

  const hasOverflow = categories.some(
    (c) => (parseInt(unsoldCounts[c.id] || "0") || 0) > c.vendu_count + c.annule_count
  );

  const reassignDest = availableMatches.find((m) => m.id === reassignMatchId);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageX className="h-5 w-5 text-red-600" />
            Déclarer les invendus
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{matchName}</p>
        </DialogHeader>

        {loadingData ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : categories.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Aucune catégorie de billets pour ce match.
          </p>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            {/* Catégories */}
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Saisir le nombre de billets invendus par catégorie. Les billets scannés à l&apos;entrée ne peuvent pas être déclarés invendus.
              </p>
              {categories.map((cat) => {
                const totalPrinted = cat.vendu_count + cat.scanne_count + cat.annule_count;
                const maxUnsold = cat.vendu_count + cat.annule_count;
                const noPrinted = totalPrinted === 0;
                const allScanned = totalPrinted > 0 && maxUnsold === 0;
                const isLocked = noPrinted || allScanned;
                const currentVal = parseInt(unsoldCounts[cat.id] || "0") || 0;
                const isOver = currentVal > maxUnsold;

                let bgClass = "bg-muted/40";
                if (allScanned) bgClass = "bg-green-50 border border-green-200";
                if (noPrinted) bgClass = "bg-muted/20 border border-muted opacity-60";

                return (
                  <div key={cat.id} className={`rounded-lg p-3 ${bgClass}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{cat.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFCFA(cat.price)} · {totalPrinted} imprimés · {cat.scanne_count} scannés
                          {cat.annule_count > 0 && ` · ${cat.annule_count} invendus`}
                        </p>
                        {noPrinted && (
                          <p className="text-xs text-muted-foreground font-medium mt-0.5">
                            Aucun billet imprimé pour cette catégorie
                          </p>
                        )}
                        {allScanned && (
                          <p className="text-xs text-green-700 font-medium mt-0.5">
                            ✓ Tous les billets ont été validés à l&apos;entrée
                          </p>
                        )}
                        {isOver && (
                          <p className="text-xs text-red-600 mt-0.5">
                            Max : {maxUnsold} (billets non scannés)
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Label className={`text-xs ${allScanned ? "text-green-600" : "text-muted-foreground"}`}>
                          Invendus
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          max={maxUnsold}
                          value={isLocked ? "0" : (unsoldCounts[cat.id] ?? "")}
                          onChange={(e) =>
                            setUnsoldCounts((prev) => ({ ...prev, [cat.id]: e.target.value }))
                          }
                          placeholder="0"
                          disabled={isLocked}
                          className={`w-24 text-center ${
                            isLocked
                              ? "opacity-40 cursor-not-allowed"
                              : isOver
                                ? "border-red-400"
                                : ""
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Récap déduction */}
            {totalUnsold > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                <p className="font-semibold text-red-800">
                  {totalUnsold} invendu(s) — déduction de {formatFCFA(totalDeduction)} des recettes
                </p>
              </div>
            )}

            {/* Réattribution (optionnel) */}
            {availableMatches.length > 0 && (
              <div className="border-t pt-4 space-y-2">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-semibold">Attribuer les billets à un autre match</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Les billets non scannés seront rattachés à ce match. Les QR codes ne changent pas — les billets imprimés restent valides.
                </p>
                <Select value={reassignMatchId} onValueChange={(v) => setReassignMatchId(v ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir le match de destination (optionnel)" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMatches.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.home_team} vs {m.away_team} — {formatDateShort(m.match_date)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {reassignDest && (
                  <p className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                    Les billets non scannés seront transférés vers <strong>{reassignDest.home_team} vs {reassignDest.away_team}</strong>.
                  </p>
                )}
              </div>
            )}

            {/* Bouton unique */}
            <Button
              type="submit"
              className="w-full bg-brand hover:bg-brand/90"
              disabled={saving || hasOverflow}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : reassignMatchId ? (
                "Enregistrer et transférer les billets"
              ) : (
                "Enregistrer"
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { printTicketBloc, getMatchCategoriesForSale } from "@/lib/actions/ticket-actions";
import { printViaFrame } from "@/lib/print-frame";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Printer, Package } from "lucide-react";
import { toast } from "sonner";
import { formatFCFA } from "@/lib/format";

interface Category {
  id: string;
  name: string;
  price: number;
}

interface PrintBlocsButtonProps {
  matchId: string;
  matchName: string;
}

export function PrintBlocsButton({ matchId, matchName }: PrintBlocsButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingCats, setLoadingCats] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [blocs, setBlocs] = useState(1);

  async function handleOpen() {
    setOpen(true);
    setLoadingCats(true);
    const data = await getMatchCategoriesForSale(matchId);
    setLoadingCats(false);
    if (data && data.length > 0) {
      setCategories(data);
      setCategoryId(data[0].id);
    } else {
      setCategories([]);
      setCategoryId("");
    }
  }

  async function handlePrint() {
    if (!categoryId) { toast.error("Sélectionnez une catégorie"); return; }
    setLoading(true);
    const result = await printTicketBloc(matchId, categoryId, blocs);
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setOpen(false);
    toast.success(`${blocs} bloc${blocs > 1 ? "s" : ""} généré${blocs > 1 ? "s" : ""} — impression en cours…`);
    printViaFrame(`/api/tickets/print-batch?batch=${result.batchId}&fmt=80`);
  }

  const selectedCat = categories.find((c) => c.id === categoryId);
  const totalTickets = blocs * 100;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleOpen}
        className="text-brand border-brand h-7 px-2"
        title="Imprimer les billets en blocs de 100"
      >
        <Printer className="h-3 w-3 mr-1" />
        Imprimer
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-brand" />
              Imprimer les billets
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">{matchName}</p>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Catégorie de billet</Label>
              {loadingCats ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Chargement…
                </div>
              ) : categories.length === 0 ? (
                <p className="text-sm text-danger">
                  Aucune catégorie configurée pour ce match. Créez d&apos;abord des catégories de billets.
                </p>
              ) : (
                <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} — {formatFCFA(c.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label>
                Nombre de blocs{" "}
                <span className="text-muted-foreground font-normal">(1 bloc = 100 billets)</span>
              </Label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setBlocs((b) => Math.max(1, b - 1))}
                  disabled={blocs <= 1}
                  className="w-10 h-10 rounded-lg border border-border flex items-center justify-center text-xl font-bold disabled:opacity-30 hover:bg-muted transition-colors"
                >
                  −
                </button>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={blocs}
                  onChange={(e) => setBlocs(Math.max(1, parseInt(e.target.value) || 1))}
                  className="text-center text-2xl font-bold h-12 flex-1"
                />
                <button
                  type="button"
                  onClick={() => setBlocs((b) => Math.min(50, b + 1))}
                  disabled={blocs >= 50}
                  className="w-10 h-10 rounded-lg border border-border flex items-center justify-center text-xl font-bold disabled:opacity-30 hover:bg-muted transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {selectedCat && (
              <div className="bg-brand/5 border border-brand/20 rounded-xl p-4 text-center space-y-1">
                <p className="text-3xl font-bold text-brand">
                  {blocs} bloc{blocs > 1 ? "s" : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  {totalTickets.toLocaleString("fr-FR")} billets × {formatFCFA(selectedCat.price)}
                </p>
                <p className="text-xl font-bold">
                  = {formatFCFA(totalTickets * selectedCat.price)}
                </p>
              </div>
            )}

            <Button
              type="button"
              onClick={handlePrint}
              disabled={loading || !categoryId || categories.length === 0}
              className="w-full h-12 bg-brand hover:bg-brand/90"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Printer className="h-5 w-5 mr-2" />
                  Générer et imprimer {totalTickets} billets
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

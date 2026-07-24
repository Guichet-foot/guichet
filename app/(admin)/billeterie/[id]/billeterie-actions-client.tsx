"use client";

import { useState } from "react";
import { addTicketsToBilleterie, withdrawBilleterieTickets } from "@/lib/actions/billeterie-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Printer, Plus, Loader2, Minus } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function PrintBatchButton({ batchId, count, fmt = "80" }: { batchId: string; count: number; fmt?: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => window.open(`/api/billeterie/print-batch?batch=${batchId}&fmt=${fmt}`, "_blank")}
    >
      <Printer className="h-4 w-4 mr-1.5" />
      Imprimer ({count})
    </Button>
  );
}

export function WithdrawTicketsDialog({ billeterieId, totalActive }: { billeterieId: string; totalActive: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState("1");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1) { toast.error("Quantité invalide"); return; }
    if (qty > totalActive) { toast.error(`Impossible de retirer plus que le total (${totalActive})`); return; }

    setLoading(true);
    const result = await withdrawBilleterieTickets(billeterieId, qty);
    setLoading(false);

    if (result.error) { toast.error(result.error); return; }
    toast.success(`${result.count} billet(s) retiré(s)`);
    setOpen(false);
    setQuantity("1");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" size="sm" />}>
        <Minus className="h-4 w-4 mr-2" />
        Retirer des Billets
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Retirer des billets</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="withdraw-qty">Nombre de billets à retirer</Label>
            <Input
              id="withdraw-qty"
              type="number"
              min="1"
              max={totalActive}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">{totalActive} billet(s) disponible(s)</p>
          </div>
          <p className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded p-2">
            Les billets retirés ne seront plus comptabilisés dans les statistiques. Les QR codes restent valides.
          </p>
          <Button type="submit" variant="destructive" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {loading ? "Retrait en cours…" : `Retirer ${quantity} billet(s)`}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddTicketsDialog({
  billeterieId,
  categoryName,
  label,
}: {
  billeterieId: string;
  categoryName?: string;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState("100");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1) { toast.error("Quantité invalide"); return; }

    setLoading(true);
    const result = await addTicketsToBilleterie(billeterieId, qty, categoryName);
    setLoading(false);

    if (result.error) { toast.error(result.error); return; }

    toast.success(`${result.count} billet(s) ajouté(s)`);
    setOpen(false);

    if (result.batchId) {
      window.open(`/api/billeterie/print-batch?batch=${result.batchId}&fmt=80`, "_blank");
    }
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Plus className="h-4 w-4 mr-2" />
        {label ?? "Ajouter des billets"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {categoryName ? `Ajouter des billets — ${categoryName}` : "Ajouter des billets"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="qty">Nombre de billets à générer</Label>
            <Input
              id="qty"
              type="number"
              min="1"
              max="10000"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Une fenêtre d&apos;impression s&apos;ouvrira automatiquement après la création.
          </p>
          <Button type="submit" className="w-full bg-brand hover:bg-brand/90" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : `Générer ${quantity} billet(s)`}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { updateBilleterie, deleteBilleterie } from "@/lib/actions/billeterie-actions";

interface Props {
  item: { id: string; name: string; price: number };
}

export function BilleterieCardActions({ item }: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(String(item.price));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    const numPrice = Number(price);
    if (!name.trim() || isNaN(numPrice) || numPrice < 0) {
      toast.error("Nom et prix valides requis");
      return;
    }
    setSaving(true);
    const result = await updateBilleterie(item.id, { name: name.trim(), price: numPrice });
    setSaving(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Billetterie modifiée");
    setEditOpen(false);
    router.refresh();
  }

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteBilleterie(item.id);
    setDeleting(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success(`"${item.name}" supprimée`);
    setDeleteOpen(false);
    router.refresh();
  }

  return (
    <>
      <div className="flex gap-1">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 rounded-full bg-background/90 hover:bg-background shadow-sm border border-border/60"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setName(item.name);
            setPrice(String(item.price));
            setEditOpen(true);
          }}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 rounded-full bg-background/90 hover:bg-background shadow-sm border border-border/60 text-destructive hover:text-destructive"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDeleteOpen(true);
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le pass</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bil-name">Nom du pass</Label>
              <Input
                id="bil-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Pass Navétane 2024"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bil-price">Prix (FCFA)</Label>
              <Input
                id="bil-price"
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)} disabled={saving}>
                Annuler
              </Button>
              <Button type="submit" className="bg-brand hover:bg-brand/90" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer le pass</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Supprimer{" "}
            <span className="font-semibold text-foreground">&ldquo;{item.name}&rdquo;</span>{" "}?
            Tous les billets et scans associés seront également supprimés. Cette action est
            irréversible.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

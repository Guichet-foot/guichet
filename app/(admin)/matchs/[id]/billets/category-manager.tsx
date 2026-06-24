"use client";

import { useState } from "react";
import {
  upsertTicketCategory,
  deleteTicketCategory,
} from "@/lib/actions/match-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatFCFA } from "@/lib/format";
import type { TicketCategory } from "@/lib/types";

interface CategoryManagerProps {
  matchId: string;
  categories: TicketCategory[];
  soldCounts: Record<string, number>;
}

export function CategoryManager({
  matchId,
  categories,
  soldCounts,
}: CategoryManagerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [quantityTotal, setQuantityTotal] = useState("");
  const [displayOrder, setDisplayOrder] = useState("0");

  function resetForm() {
    setName("");
    setPrice("");
    setQuantityTotal("");
    setDisplayOrder("0");
    setEditingId(null);
  }

  function openEdit(cat: TicketCategory) {
    setEditingId(cat.id);
    setName(cat.name);
    setPrice(String(cat.price));
    setQuantityTotal(String(cat.quantity_total));
    setDisplayOrder(String(cat.display_order));
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const result = await upsertTicketCategory({
      id: editingId || undefined,
      matchId,
      name,
      price: parseInt(price),
      quantityTotal: parseInt(quantityTotal),
      displayOrder: parseInt(displayOrder),
    });

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(editingId ? "Catégorie modifiée" : "Catégorie ajoutée");
      resetForm();
      setOpen(false);
    }
    setLoading(false);
  }

  async function handleDelete(categoryId: string) {
    if (!confirm("Supprimer cette catégorie ?")) return;

    const result = await deleteTicketCategory(categoryId, matchId);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Catégorie supprimée");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) resetForm();
          }}
        >
          <DialogTrigger
            render={<Button className="bg-brand hover:bg-brand/90" />}
          >
            <Plus className="h-4 w-4 mr-2" />
            Ajouter une catégorie
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Modifier la catégorie" : "Nouvelle catégorie"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Tribune, Pelouse, VIP..."
                />
              </div>
              <div className="space-y-2">
                <Label>Prix (FCFA)</Label>
                <Input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                  min="0"
                  step="100"
                  placeholder="1500"
                />
              </div>
              <div className="space-y-2">
                <Label>Quantité disponible</Label>
                <Input
                  type="number"
                  value={quantityTotal}
                  onChange={(e) => setQuantityTotal(e.target.value)}
                  required
                  min="1"
                  placeholder="200"
                />
              </div>
              <div className="space-y-2">
                <Label>Ordre d&apos;affichage</Label>
                <Input
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(e.target.value)}
                  min="0"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-brand hover:bg-brand/90"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : editingId ? (
                  "Modifier"
                ) : (
                  "Ajouter"
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Aucune catégorie. Ajoutez-en une pour commencer les ventes.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {categories.map((cat) => {
            const sold = soldCounts[cat.id] || 0;
            const hasSales = sold > 0;
            return (
              <Card key={cat.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{cat.name}</h3>
                      <p className="text-lg font-bold text-brand">
                        {formatFCFA(cat.price)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {sold} / {cat.quantity_total} vendus — Ordre :{" "}
                        {cat.display_order}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {!hasSales && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(cat)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-danger"
                            onClick={() => handleDelete(cat.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {hasSales && (
                        <span className="text-xs text-muted-foreground italic">
                          Verrouillé
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

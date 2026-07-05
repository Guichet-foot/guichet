"use client";

import { useState } from "react";
import { createTicketTemplate, updateTicketTemplate } from "@/lib/actions/ticket-template-actions";
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
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface TicketTemplateFormProps {
  zoneId?: string | null;
  c3AccountId?: string | null;
  editTemplate?: {
    id: string;
    name: string;
    price: number;
    default_quantity: number;
    color: string;
    description?: string;
  };
  trigger?: React.ReactNode;
}

export function TicketTemplateForm({ zoneId, c3AccountId, editTemplate, trigger }: TicketTemplateFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(editTemplate?.name || "");
  const [description, setDescription] = useState(editTemplate?.description || "");
  const [price, setPrice] = useState(editTemplate?.price?.toString() || "");
  const [quantity, setQuantity] = useState(editTemplate?.default_quantity?.toString() || "100");
  const [color, setColor] = useState(editTemplate?.color || "#0D5C3F");

  function resetForm() {
    if (!editTemplate) {
      setName("");
      setDescription("");
      setPrice("");
      setQuantity("100");
      setColor("#0D5C3F");
    }
  }

  async function handleSubmit() {
    if (!name.trim() || !price) {
      toast.error("Remplissez le nom et le prix");
      return;
    }
    setLoading(true);

    if (editTemplate) {
      const result = await updateTicketTemplate(editTemplate.id, {
        name,
        price: parseInt(price),
        defaultQuantity: parseInt(quantity),
        color,
        description,
      });
      if (result.error) toast.error(result.error);
      else { toast.success("Catégorie modifiée"); setOpen(false); }
    } else {
      const result = await createTicketTemplate({
        zoneId: zoneId || null,
        c3AccountId: c3AccountId || null,
        name,
        price: parseInt(price),
        defaultQuantity: parseInt(quantity),
        color,
        description,
      });
      if (result.error) toast.error(result.error);
      else { toast.success("Catégorie créée"); resetForm(); setOpen(false); }
    }
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger render={<span />}>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger render={<Button className="bg-brand hover:bg-brand/90" />}>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter une catégorie
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editTemplate ? "Modifier la catégorie" : "Nouvelle catégorie de billet"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nom de la catégorie</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Tribune Centrale, VIP, Pelouse..." />
          </div>

          <div className="space-y-2">
            <Label>Description (optionnel)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Meilleure vue du match, Accès salon VIP..." />
          </div>

          <div className="space-y-2">
            <Label>Prix (FCFA)</Label>
            <Input type="number" min="0" step="100" value={price} onChange={(e) => setPrice(e.target.value)} required placeholder="5000" />
          </div>

          <div className="space-y-2">
            <Label>Couleur</Label>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg border border-border cursor-pointer relative overflow-hidden shrink-0"
                style={{ backgroundColor: color }}
              >
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </div>
              <Input value={color} onChange={(e) => setColor(e.target.value)} className="font-mono text-sm" />
            </div>
          </div>

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-brand hover:bg-brand/90"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : editTemplate ? "Modifier" : "Créer la catégorie"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

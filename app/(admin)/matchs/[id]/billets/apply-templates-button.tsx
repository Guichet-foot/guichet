"use client";

import { useState } from "react";
import { applyTemplatesToMatch } from "@/lib/actions/ticket-template-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Ticket, Check } from "lucide-react";
import { toast } from "sonner";
import { formatFCFA } from "@/lib/format";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface ApplyTemplatesButtonProps {
  matchId: string;
  templates: any[];
  hasExistingCategories: boolean;
}

export function ApplyTemplatesButton({
  matchId,
  templates,
  hasExistingCategories,
}: ApplyTemplatesButtonProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  function toggleTemplate(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === templates.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(templates.map((t) => t.id)));
    }
  }

  async function handleApply() {
    if (selected.size === 0) {
      toast.error("Sélectionnez au moins un billet");
      return;
    }
    setLoading(true);
    const result = await applyTemplatesToMatch(matchId, Array.from(selected));
    if (result.error) toast.error(result.error);
    else {
      toast.success(`${result.count} catégorie(s) ajoutée(s)`);
      setOpen(false);
      setSelected(new Set());
    }
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="border-brand text-brand" />}>
        <Ticket className="h-4 w-4 mr-2" />
        Ajouter depuis les modèles
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sélectionner les billets</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {selected.size} sélectionné(s)
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={selectAll}>
              {selected.size === templates.length ? "Tout désélectionner" : "Tout sélectionner"}
            </Button>
          </div>

          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {templates.map((t: any) => {
              const isSelected = selected.has(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTemplate(t.id)}
                  className={`w-full text-left rounded-lg border-2 p-3 transition-colors ${
                    isSelected
                      ? "border-brand bg-brand/5"
                      : "border-border hover:border-brand/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-8 rounded-sm shrink-0"
                        style={{ backgroundColor: t.color || "#0D5C3F" }}
                      />
                      <div>
                        <p className="font-semibold">{t.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatFCFA(t.price)} — Qté : {t.default_quantity}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="h-5 w-5 text-brand shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {hasExistingCategories && (
            <p className="text-xs text-muted-foreground bg-orange-50 p-2 rounded">
              Ce match a déjà des catégories. Les modèles seront ajoutés en plus.
            </p>
          )}

          <Button
            type="button"
            onClick={handleApply}
            disabled={loading || selected.size === 0}
            className="w-full bg-brand hover:bg-brand/90"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              `Appliquer ${selected.size} billet(s)`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

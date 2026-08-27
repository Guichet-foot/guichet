"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Loader2, Plus, Check, Trophy, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  updateBilleterie,
  deleteBilleterie,
  getAllMatchesForBilleterie,
} from "@/lib/actions/billeterie-actions";
import type { MatchOption, BilCategory } from "@/lib/actions/billeterie-actions";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { formatFCFA } from "@/lib/format";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Props {
  item: {
    id: string;
    name: string;
    price: number;
    categories?: BilCategory[] | null;
    matchIds?: string[];
  };
}

export function BilleterieCardActions({ item }: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Form state
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(String(item.price));
  const [multiCat, setMultiCat] = useState(!!(item.categories && item.categories.length > 0));
  const [categories, setCategories] = useState<BilCategory[]>(
    item.categories && item.categories.length > 0 ? item.categories : [{ name: "", price: 0 }]
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(item.matchIds || [])
  );

  // Available matches (loaded on open)
  const [matches, setMatches] = useState<MatchOption[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!editOpen) return;
    setLoadingMatches(true);
    getAllMatchesForBilleterie().then((data) => {
      setMatches(data);
      setLoadingMatches(false);
    });
  }, [editOpen]);

  function openEdit(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setName(item.name);
    setPrice(String(item.price));
    const hasCats = !!(item.categories && item.categories.length > 0);
    setMultiCat(hasCats);
    setCategories(hasCats ? item.categories! : [{ name: "", price: 0 }]);
    setSelectedIds(new Set(item.matchIds || []));
    setEditOpen(true);
  }

  function toggleMatch(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addCategory() {
    setCategories((prev) => [...prev, { name: "", price: 0 }]);
  }

  function removeCategory(idx: number) {
    setCategories((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateCategory(idx: number, field: "name" | "price", value: string) {
    setCategories((prev) =>
      prev.map((c, i) =>
        i === idx
          ? { ...c, [field]: field === "price" ? (parseInt(value) || 0) : value }
          : c
      )
    );
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error("Nom obligatoire"); return; }

    if (multiCat) {
      if (categories.length === 0) { toast.error("Ajoutez au moins une catégorie"); return; }
      if (categories.some((c) => !c.name.trim())) { toast.error("Chaque catégorie doit avoir un nom"); return; }
      if (categories.some((c) => isNaN(c.price) || c.price < 0)) { toast.error("Prix invalide dans une catégorie"); return; }
    } else {
      const numPrice = Number(price);
      if (isNaN(numPrice) || numPrice < 0) { toast.error("Prix invalide"); return; }
    }

    setSaving(true);
    const result = await updateBilleterie(item.id, {
      name: name.trim(),
      price: multiCat ? 0 : Number(price),
      matchIds: Array.from(selectedIds),
      categories: multiCat ? categories : null,
    });
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
          onClick={openEdit}
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

      {/* ── Edit Sheet (full-height side panel, scrollable, mobile-friendly) ── */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg overflow-y-auto p-0"
        >
          <form onSubmit={handleEdit} className="flex flex-col h-full">
            <SheetHeader className="px-5 pt-5 pb-4 border-b shrink-0">
              <SheetTitle>Modifier le pass</SheetTitle>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
              {/* ── Nom ── */}
              <div className="space-y-2">
                <Label htmlFor="bil-name">Nom du pass</Label>
                <Input
                  id="bil-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Ex: Pass Phase de Poules"
                />
              </div>

              {/* ── Toggle multi-catégories ── */}
              <div className="flex items-center gap-3 rounded-lg border p-3 bg-muted/30">
                <button
                  type="button"
                  role="switch"
                  aria-checked={multiCat}
                  onClick={() => setMultiCat((v) => !v)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    multiCat ? "bg-brand" : "bg-muted-foreground/30"
                  }`}
                >
                  <span
                    className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg transform transition-transform ${
                      multiCat ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
                <div>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-brand" />
                    Multi-catégories
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Plusieurs prix (ex: Tribune 1 000 FCFA, Populaire 500 FCFA)
                  </p>
                </div>
              </div>

              {/* ── Prix unique ── */}
              {!multiCat && (
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
                  {price && !isNaN(Number(price)) && (
                    <p className="text-xs text-muted-foreground">{formatFCFA(Number(price))}</p>
                  )}
                </div>
              )}

              {/* ── Catégories ── */}
              {multiCat && (
                <div className="space-y-3">
                  <Label>Catégories de billets</Label>
                  <div className="space-y-2">
                    {categories.map((cat, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input
                          value={cat.name}
                          onChange={(e) => updateCategory(idx, "name", e.target.value)}
                          placeholder="Tribune, Populaire…"
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          min="0"
                          value={cat.price || ""}
                          onChange={(e) => updateCategory(idx, "price", e.target.value)}
                          placeholder="Prix FCFA"
                          className="w-28"
                        />
                        {categories.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 p-0 text-destructive shrink-0"
                            onClick={() => removeCategory(idx)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  {categories.length > 0 && categories.every((c) => c.name && c.price >= 0) && (
                    <div className="text-xs text-muted-foreground space-y-0.5 bg-muted/40 rounded p-2">
                      {categories.map((c, i) => (
                        <p key={i}>{c.name} : {formatFCFA(c.price)}</p>
                      ))}
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addCategory}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Ajouter une catégorie
                  </Button>
                </div>
              )}

              {/* ── Matchs ── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5">
                    <Trophy className="h-3.5 w-3.5 text-brand" />
                    Matchs inclus
                    {selectedIds.size > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {selectedIds.size}
                      </Badge>
                    )}
                  </Label>
                  {matches.length > 0 && (
                    <button
                      type="button"
                      className="text-xs text-brand hover:underline"
                      onClick={() =>
                        setSelectedIds(
                          selectedIds.size === matches.length
                            ? new Set()
                            : new Set(matches.map((m) => m.id))
                        )
                      }
                    >
                      {selectedIds.size === matches.length ? "Désélectionner tout" : "Tout sélectionner"}
                    </button>
                  )}
                </div>

                {loadingMatches ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Chargement des matchs…
                  </div>
                ) : matches.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    Aucun match programmé disponible.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {/* Current matchIds not in available matches (already played) */}
                    {Array.from(selectedIds)
                      .filter((id) => !matches.find((m) => m.id === id))
                      .map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => toggleMatch(id)}
                          className="w-full text-left rounded-lg border-2 border-brand bg-brand/5 p-3 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold truncate text-muted-foreground italic">
                              Match déjà joué (ID …{id.slice(-8)})
                            </p>
                            <Check className="h-4 w-4 text-brand shrink-0 mt-0.5" />
                          </div>
                        </button>
                      ))}
                    {matches.map((m) => {
                      const isSelected = selectedIds.has(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleMatch(m.id)}
                          className={`w-full text-left rounded-lg border-2 p-3 transition-colors ${
                            isSelected ? "border-brand bg-brand/5" : "border-border hover:border-brand/30"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate">
                                {m.home_team} vs {m.away_team}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {format(new Date(m.match_date), "EEE d MMM yyyy · HH'h'mm", { locale: fr })}
                                {m.match_type && ` · ${m.match_type}`}
                              </p>
                            </div>
                            {isSelected && <Check className="h-4 w-4 text-brand shrink-0 mt-0.5" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="px-5 py-4 border-t flex gap-3 shrink-0 bg-background">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setEditOpen(false)}
                disabled={saving}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-brand hover:bg-brand/90"
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* ── Delete Dialog ── */}
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

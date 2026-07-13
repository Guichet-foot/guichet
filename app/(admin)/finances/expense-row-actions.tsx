"use client";

import { useState } from "react";
import { updateExpense, deleteExpense } from "@/lib/actions/expense-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/constants";

interface MatchOption {
  id: string;
  label: string;
}

interface Expense {
  id: string;
  label: string;
  category: string;
  amount: number;
  expense_date: string;
  match_id: string | null;
  notes: string | null;
}

const PREDEFINED_KEYS = Object.keys(EXPENSE_CATEGORY_LABELS).filter((k) => k !== "autre");

export function ExpenseRowActions({
  expense,
  matches,
}: {
  expense: Expense;
  matches: MatchOption[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Detect if category is predefined or custom
  const isPredefined = PREDEFINED_KEYS.includes(expense.category);
  const [label, setLabel] = useState(expense.label);
  const [category, setCategory] = useState(isPredefined ? expense.category : "autre_custom");
  const [customCategory, setCustomCategory] = useState(isPredefined ? "" : expense.category);
  const [amount, setAmount] = useState(String(expense.amount));
  const [expenseDate, setExpenseDate] = useState(expense.expense_date);
  const [matchId, setMatchId] = useState(expense.match_id || "none");
  const [notes, setNotes] = useState(expense.notes || "");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const finalCategory = category === "autre_custom" ? customCategory : category;
    if (!finalCategory) {
      toast.error("Choisissez une catégorie");
      setSaving(false);
      return;
    }
    const result = await updateExpense(expense.id, {
      matchId: matchId === "none" ? null : matchId,
      label,
      category: finalCategory,
      amount: parseInt(amount),
      expenseDate,
      notes,
    });
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Dépense mise à jour");
    setEditOpen(false);
  }

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteExpense(expense.id);
    setDeleting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Dépense supprimée");
    setDeleteOpen(false);
  }

  return (
    <>
      <div className="flex items-center gap-1 justify-end">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => setEditOpen(true)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-danger"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Dialog modifier */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier la dépense</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Match (optionnel)</Label>
              <Select value={matchId} onValueChange={(v) => setMatchId(v ?? "none")}>
                <SelectTrigger>
                  <SelectValue placeholder="Global zone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Global zone</SelectItem>
                  {matches.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Libellé</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Select
                value={category}
                onValueChange={(v) => {
                  setCategory(v ?? "");
                  if (v !== "autre_custom") setCustomCategory("");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PREDEFINED_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {EXPENSE_CATEGORY_LABELS[key]}
                    </SelectItem>
                  ))}
                  <SelectItem value="autre_custom">Autre (personnalisée)</SelectItem>
                </SelectContent>
              </Select>
              {category === "autre_custom" && (
                <Input
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  required
                  placeholder="Nom de la catégorie"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>Montant (FCFA)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                min="1"
              />
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Notes (optionnel)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Détails..."
              />
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" className="bg-brand hover:bg-brand/90" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog confirmer suppression */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer la dépense</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Supprimer <span className="font-semibold text-foreground">{expense.label}</span> ({expense.amount.toLocaleString("fr-FR")} FCFA) ? Cette action est irréversible.
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

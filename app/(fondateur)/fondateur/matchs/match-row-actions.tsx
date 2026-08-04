"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import {
  updateMatchAsFondateur,
  updateMatchStatusAsFondateur,
  deleteMatchAsFondateur,
} from "@/lib/actions/fondateur-match-actions";
import { MATCH_STATUS_LABELS } from "@/lib/constants";
import type { MatchStatus } from "@/lib/types";

interface MatchRowActionsProps {
  match: {
    id: string;
    home_team: string;
    away_team: string;
    venue: string;
    match_date: string;
    notes: string | null;
    status: string;
  };
}

function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MatchRowActions({ match }: MatchRowActionsProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [homeTeam, setHomeTeam] = useState(match.home_team);
  const [awayTeam, setAwayTeam] = useState(match.away_team);
  const [venue, setVenue] = useState(match.venue);
  const [matchDate, setMatchDate] = useState(toDatetimeLocal(match.match_date));
  const [notes, setNotes] = useState(match.notes || "");

  function openEdit() {
    setHomeTeam(match.home_team);
    setAwayTeam(match.away_team);
    setVenue(match.venue);
    setMatchDate(toDatetimeLocal(match.match_date));
    setNotes(match.notes || "");
    setEditOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!homeTeam.trim() || !awayTeam.trim() || !venue.trim() || !matchDate) {
      toast.error("Remplissez tous les champs obligatoires");
      return;
    }
    setSaving(true);
    const result = await updateMatchAsFondateur(match.id, {
      homeTeam: homeTeam.trim(),
      awayTeam: awayTeam.trim(),
      venue: venue.trim(),
      matchDate: new Date(matchDate).toISOString(),
      notes: notes.trim(),
    });
    setSaving(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Match modifié !");
    setEditOpen(false);
  }

  async function handleStatusChange(value: string) {
    const result = await updateMatchStatusAsFondateur(match.id, value as MatchStatus);
    if (result.error) toast.error(result.error);
    else toast.success("Statut mis à jour");
  }

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteMatchAsFondateur(match.id);
    setDeleting(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Match supprimé");
    setDeleteOpen(false);
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        {/* Status select */}
        <Select defaultValue={match.status} onValueChange={(v) => v && handleStatusChange(v)}>
          <SelectTrigger className="w-[120px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(MATCH_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Edit */}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={openEdit} title="Modifier">
          <Pencil className="h-4 w-4" />
        </Button>

        {/* Delete */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => setDeleteOpen(true)}
          title="Supprimer"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le match</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor={`home-${match.id}`}>Équipe domicile *</Label>
              <Input id={`home-${match.id}`} value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`away-${match.id}`}>Équipe visiteur *</Label>
              <Input id={`away-${match.id}`} value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`venue-${match.id}`}>Lieu (stade) *</Label>
              <Input id={`venue-${match.id}`} value={venue} onChange={(e) => setVenue(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`date-${match.id}`}>Date et heure *</Label>
              <Input
                id={`date-${match.id}`}
                type="datetime-local"
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`notes-${match.id}`}>Notes (optionnel)</Label>
              <Textarea
                id={`notes-${match.id}`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Informations complémentaires…"
                rows={2}
              />
            </div>
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setEditOpen(false)} disabled={saving}>
                Annuler
              </Button>
              <Button type="submit" className="flex-1 bg-brand hover:bg-brand/90" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer le match ?</DialogTitle>
            <DialogDescription>
              <strong>{match.home_team} vs {match.away_team}</strong> sera définitivement supprimé ainsi que tous ses tickets.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Annuler
            </Button>
            <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Supprimer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

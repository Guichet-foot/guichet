"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createOdcavInterMatch, getOdcavTeamsWithZones } from "@/lib/actions/odcav-match-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { formatFCFA } from "@/lib/format";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface TeamOption {
  id: string;
  name: string;
  zone_id: string;
  zone_name: string;
}

interface Props {
  matchType: "Match Communal" | "Match Départemental";
  backHref: string;
  title: string;
}

export function NouveauInterMatchForm({ matchType, backHref, title }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<TeamOption[]>([]);

  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [venue, setVenue] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [notes, setNotes] = useState("");
  const [inlineCats, setInlineCats] = useState<{ name: string; price: string }[]>([{ name: "", price: "" }]);

  useEffect(() => {
    getOdcavTeamsWithZones().then((data) => setTeams(data));
  }, []);

  function addCat() {
    setInlineCats((prev) => [...prev, { name: "", price: "" }]);
  }

  function removeCat(i: number) {
    setInlineCats((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateCat(i: number, field: "name" | "price", value: string) {
    setInlineCats((prev) => prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
  }

  const homeTeam = teams.find((t) => t.id === homeTeamId);
  const awayTeam = teams.find((t) => t.id === awayTeamId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!homeTeamId || !awayTeamId) { toast.error("Sélectionnez les deux équipes"); return; }
    if (homeTeamId === awayTeamId) { toast.error("Les deux équipes doivent être différentes"); return; }

    const validCats = inlineCats.filter((c) => c.name.trim() && c.price);
    if (validCats.length === 0) { toast.error("Ajoutez au moins une catégorie de billet"); return; }

    const inlineCategories = validCats.map((c) => ({
      name: c.name.trim(),
      price: Math.round(parseFloat(c.price)),
    }));

    setLoading(true);
    const result = await createOdcavInterMatch({
      homeTeam: homeTeam!.name,
      homeTeamZone: homeTeam!.zone_name,
      awayTeam: awayTeam!.name,
      awayTeamZone: awayTeam!.zone_name,
      matchType,
      venue,
      matchDate: new Date(matchDate).toISOString(),
      notes,
      inlineCategories,
    });
    setLoading(false);

    if (result.error) { toast.error(result.error); return; }
    toast.success("Match créé");
    router.push(backHref);
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href={backHref}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Button>
        </Link>
        <h1 className="text-2xl font-bold font-heading">{title}</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Équipe domicile */}
            <div className="space-y-2">
              <Label>Équipe domicile</Label>
              <Select value={homeTeamId} onValueChange={(v) => setHomeTeamId(v ?? "")} required>
                <SelectTrigger>
                  <SelectValue placeholder={teams.length === 0 ? "Chargement…" : "Choisir l'équipe domicile"} />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {t.zone_name && <span className="text-muted-foreground ml-1">({t.zone_name})</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {homeTeam && (
                <p className="text-xs text-muted-foreground">
                  Zone : {homeTeam.zone_name} — sur le billet : <strong>{homeTeam.name} ({homeTeam.zone_name})</strong>
                </p>
              )}
            </div>

            {/* Équipe visiteur */}
            <div className="space-y-2">
              <Label>Équipe visiteur</Label>
              <Select value={awayTeamId} onValueChange={(v) => setAwayTeamId(v ?? "")} required>
                <SelectTrigger>
                  <SelectValue placeholder={teams.length === 0 ? "Chargement…" : "Choisir l'équipe visiteur"} />
                </SelectTrigger>
                <SelectContent>
                  {teams
                    .filter((t) => t.id !== homeTeamId)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                        {t.zone_name && <span className="text-muted-foreground ml-1">({t.zone_name})</span>}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {awayTeam && (
                <p className="text-xs text-muted-foreground">
                  Zone : {awayTeam.zone_name} — sur le billet : <strong>{awayTeam.name} ({awayTeam.zone_name})</strong>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="venue">Lieu (stade)</Label>
              <Input id="venue" value={venue} onChange={(e) => setVenue(e.target.value)} required placeholder="Stade Municipal de Saly" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="matchDate">Date et heure</Label>
              <Input id="matchDate" type="datetime-local" value={matchDate} onChange={(e) => setMatchDate(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optionnel)</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Informations complémentaires…" />
            </div>

            {/* Catégories de billets */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Catégories de billets</Label>
                <Button type="button" variant="outline" size="sm" onClick={addCat}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Ajouter
                </Button>
              </div>
              {inlineCats.map((cat, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1">
                    <Input
                      placeholder="Nom (ex: Tribune)"
                      value={cat.name}
                      onChange={(e) => updateCat(i, "name", e.target.value)}
                    />
                  </div>
                  <div className="w-28 space-y-1">
                    <Input
                      type="number"
                      placeholder="Prix"
                      min="0"
                      value={cat.price}
                      onChange={(e) => updateCat(i, "price", e.target.value)}
                    />
                  </div>
                  {inlineCats.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeCat(i)} className="h-10 w-10 p-0 text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {inlineCats.filter((c) => c.name && c.price).length > 0 && (
                <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
                  {inlineCats.filter((c) => c.name && c.price).map((c, i) => (
                    <p key={i}>{c.name} — {formatFCFA(parseFloat(c.price) || 0)}</p>
                  ))}
                </div>
              )}
            </div>

            <Button type="submit" className="w-full bg-brand hover:bg-brand/90" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Créer le match"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

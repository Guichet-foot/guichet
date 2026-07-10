"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createDirectMatch } from "@/lib/actions/fondateur-match-actions";
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
import { Loader2, Plus, Ticket, Trash2 } from "lucide-react";
import { toast } from "sonner";

const MATCH_TYPES = [
  "Match Zonal",
  "Match Communal",
  "Match Régional",
  "Match Départemental",
  "Match Inter-zones",
  "Match Amical",
];

interface InlineCat { name: string; price: string; }

export function NouveauDirectMatchForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [homeTeam, setHomeTeam] = useState("");
  const [homeTeamZone, setHomeTeamZone] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [awayTeamZone, setAwayTeamZone] = useState("");
  const [matchType, setMatchType] = useState("");
  const [venue, setVenue] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [notes, setNotes] = useState("");
  const [inlineCats, setInlineCats] = useState<InlineCat[]>([]);

  function addInlineCat() {
    setInlineCats((prev) => [...prev, { name: "", price: "" }]);
  }

  function updateInlineCat(i: number, field: keyof InlineCat, value: string) {
    setInlineCats((prev) => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
  }

  function removeInlineCat(i: number) {
    setInlineCats((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!homeTeam.trim() || !awayTeam.trim()) { toast.error("Entrez les noms des deux équipes"); return; }
    if (homeTeam.trim() === awayTeam.trim()) { toast.error("Les deux équipes doivent être différentes"); return; }
    if (inlineCats.some((c) => !c.name.trim() || !c.price)) {
      toast.error("Remplissez le nom et le prix de chaque catégorie");
      return;
    }

    setLoading(true);
    const result = await createDirectMatch({
      homeTeam: homeTeam.trim(),
      homeTeamZone: homeTeamZone.trim(),
      awayTeam: awayTeam.trim(),
      awayTeamZone: awayTeamZone.trim(),
      matchType,
      venue,
      matchDate: new Date(matchDate).toISOString(),
      notes,
      inlineCategories: inlineCats
        .filter((c) => c.name.trim() && c.price)
        .map((c) => ({ name: c.name.trim(), price: parseInt(c.price) })),
    });

    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Match direct créé");
    router.push("/fondateur/matchs?tab=direct");
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type de match */}
          <div className="space-y-2">
            <Label>Type de match</Label>
            <Select value={matchType} onValueChange={(v) => setMatchType(v ?? "")} required>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner le type" />
              </SelectTrigger>
              <SelectContent>
                {MATCH_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Ce type sera affiché sur le billet imprimé</p>
          </div>

          {/* Équipe domicile */}
          <div className="space-y-2">
            <Label>Équipe domicile</Label>
            <div className="flex gap-2">
              <Input
                value={homeTeam}
                onChange={(e) => setHomeTeam(e.target.value)}
                required
                placeholder="ASC Ndiarème"
                className="flex-1"
              />
              <Input
                value={homeTeamZone}
                onChange={(e) => setHomeTeamZone(e.target.value)}
                placeholder="Zone (opt.)"
                className="w-32"
              />
            </div>
            <p className="text-xs text-muted-foreground">La zone s&apos;affichera entre parenthèses sur le billet : <em>ASC Ndiarème (Dakar)</em></p>
          </div>

          {/* Équipe visiteur */}
          <div className="space-y-2">
            <Label>Équipe visiteur</Label>
            <div className="flex gap-2">
              <Input
                value={awayTeam}
                onChange={(e) => setAwayTeam(e.target.value)}
                required
                placeholder="AS Pikine"
                className="flex-1"
              />
              <Input
                value={awayTeamZone}
                onChange={(e) => setAwayTeamZone(e.target.value)}
                placeholder="Zone (opt.)"
                className="w-32"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Lieu (stade)</Label>
            <Input value={venue} onChange={(e) => setVenue(e.target.value)} required placeholder="Stade Léopold Sédar Senghor" />
          </div>

          <div className="space-y-2">
            <Label>Date et heure</Label>
            <Input type="datetime-local" value={matchDate} onChange={(e) => setMatchDate(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label>Notes (optionnel)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Informations complémentaires..." />
          </div>

          {/* Catégories de billets */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <Ticket className="h-4 w-4 text-brand" />
              <Label className="text-sm font-semibold">Catégories de billets</Label>
            </div>
            {inlineCats.length > 0 && (
              <div className="space-y-2">
                {inlineCats.map((cat, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={cat.name}
                      onChange={(e) => updateInlineCat(i, "name", e.target.value)}
                      placeholder="Tribune, Pelouse, VIP..."
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={cat.price}
                      onChange={(e) => updateInlineCat(i, "price", e.target.value)}
                      placeholder="Prix FCFA"
                      min="0"
                      step="100"
                      className="w-32"
                    />
                    <button
                      type="button"
                      onClick={() => removeInlineCat(i)}
                      className="text-danger hover:text-danger/80 p-1 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <Button type="button" variant="outline" size="sm" onClick={addInlineCat} className="w-full border-dashed">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter une catégorie
            </Button>
            <p className="text-xs text-muted-foreground">Ajoutez les catégories (Tribune, Pelouse, VIP...) pour pouvoir imprimer les billets</p>
          </div>

          <Button type="submit" className="w-full bg-brand hover:bg-brand/90" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : inlineCats.filter((c) => c.name && c.price).length > 0 ? (
              `Créer le match avec ${inlineCats.filter((c) => c.name && c.price).length} catégorie(s)`
            ) : (
              "Créer le match direct"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

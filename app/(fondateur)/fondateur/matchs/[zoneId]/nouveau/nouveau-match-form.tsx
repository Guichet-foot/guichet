"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createMatchAsFondateur } from "@/lib/actions/fondateur-match-actions";
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
import { Check, Loader2, Plus, Ticket, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatFCFA } from "@/lib/format";

interface Template { id: string; name: string; price: number; color: string; }
interface InlineCat { name: string; price: string; }

interface NouveauMatchFormProps {
  zoneId: string;
  zoneName: string;
  teams: { id: string; name: string }[];
  templates: Template[];
}

export function NouveauMatchForm({ zoneId, zoneName, teams, templates }: NouveauMatchFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [venue, setVenue] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const [inlineCats, setInlineCats] = useState<InlineCat[]>([]);

  function toggleTemplate(id: string) {
    setSelectedTemplates((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

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
    if (!homeTeam || !awayTeam) { toast.error("Sélectionnez les deux équipes"); return; }
    if (homeTeam === awayTeam) { toast.error("Les deux équipes doivent être différentes"); return; }

    const validInline = inlineCats.filter((c) => c.name.trim() && c.price);
    if (inlineCats.some((c) => !c.name.trim() || !c.price)) {
      toast.error("Remplissez le nom et le prix de chaque catégorie ajoutée");
      return;
    }

    setLoading(true);
    const result = await createMatchAsFondateur({
      zoneId,
      homeTeam,
      awayTeam,
      venue,
      matchDate: new Date(matchDate).toISOString(),
      notes,
      selectedTemplateIds: Array.from(selectedTemplates),
      inlineCategories: validInline.map((c) => ({ name: c.name.trim(), price: parseInt(c.price) })),
    });

    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Match créé");
    router.push(`/fondateur/matchs/${zoneId}`);
  }

  const totalCats = selectedTemplates.size + inlineCats.filter((c) => c.name && c.price).length;

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Équipe domicile */}
          <div className="space-y-2">
            <Label>Équipe domicile</Label>
            {teams.length > 0 ? (
              <Select value={homeTeam} onValueChange={(v) => setHomeTeam(v ?? "")} required>
                <SelectTrigger><SelectValue placeholder="Sélectionner l'équipe" /></SelectTrigger>
                <SelectContent>
                  {teams.map((t) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} required placeholder="Nom de l'équipe" />
            )}
          </div>

          {/* Équipe visiteur */}
          <div className="space-y-2">
            <Label>Équipe visiteur</Label>
            {teams.length > 0 ? (
              <Select value={awayTeam} onValueChange={(v) => setAwayTeam(v ?? "")} required>
                <SelectTrigger><SelectValue placeholder="Sélectionner l'équipe" /></SelectTrigger>
                <SelectContent>
                  {teams.filter((t) => t.name !== homeTeam).map((t) => (
                    <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} required placeholder="Nom de l'équipe" />
            )}
          </div>

          <div className="space-y-2">
            <Label>Lieu (stade)</Label>
            <Input value={venue} onChange={(e) => setVenue(e.target.value)} required placeholder="Stade Municipal" />
          </div>

          <div className="space-y-2">
            <Label>Date et heure</Label>
            <Input type="datetime-local" value={matchDate} onChange={(e) => setMatchDate(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label>Notes (optionnel)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Informations complémentaires..." />
          </div>

          {/* Templates existants de la zone */}
          {templates.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Ticket className="h-4 w-4 text-brand" />
                  <Label className="text-sm font-semibold">Catégories de la zone</Label>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTemplates(selectedTemplates.size === templates.length ? new Set() : new Set(templates.map((t) => t.id)))}
                  className="text-xs text-brand hover:underline"
                >
                  {selectedTemplates.size === templates.length ? "Tout désélectionner" : "Tout sélectionner"}
                </button>
              </div>
              <div className="space-y-2">
                {templates.map((t) => {
                  const sel = selectedTemplates.has(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTemplate(t.id)}
                      className={`w-full text-left rounded-lg border-2 p-3 transition-colors ${sel ? "border-brand bg-brand/5" : "border-border hover:border-brand/30"}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-2.5 h-7 rounded-sm shrink-0" style={{ backgroundColor: t.color || "#0D5C3F" }} />
                          <div>
                            <p className="font-semibold text-sm">{t.name}</p>
                            <p className="text-xs text-muted-foreground">{formatFCFA(t.price)}</p>
                          </div>
                        </div>
                        {sel && <Check className="h-4 w-4 text-brand shrink-0" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Catégories créées directement */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <Ticket className="h-4 w-4 text-brand" />
              <Label className="text-sm font-semibold">Nouvelles catégories de billets</Label>
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
          </div>

          <Button type="submit" className="w-full bg-brand hover:bg-brand/90" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : totalCats > 0 ? (
              `Créer le match avec ${totalCats} catégorie(s)`
            ) : (
              "Créer le match"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

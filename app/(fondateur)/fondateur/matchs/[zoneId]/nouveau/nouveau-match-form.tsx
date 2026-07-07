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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface NouveauMatchFormProps {
  zoneId: string;
  zoneName: string;
  teams: { id: string; name: string }[];
}

export function NouveauMatchForm({ zoneId, zoneName, teams }: NouveauMatchFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [venue, setVenue] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!homeTeam || !awayTeam) { toast.error("Sélectionnez les deux équipes"); return; }
    if (homeTeam === awayTeam) { toast.error("Les deux équipes doivent être différentes"); return; }
    setLoading(true);

    const result = await createMatchAsFondateur({
      zoneId,
      homeTeam,
      awayTeam,
      venue,
      matchDate: new Date(matchDate).toISOString(),
      notes,
    });

    setLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Match créé");
    router.push(`/fondateur/matchs/${zoneId}`);
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Équipe domicile</Label>
            {teams.length > 0 ? (
              <Select value={homeTeam} onValueChange={(v) => setHomeTeam(v ?? "")} required>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner l'équipe" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={homeTeam}
                onChange={(e) => setHomeTeam(e.target.value)}
                required
                placeholder="Nom de l'équipe"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Équipe visiteur</Label>
            {teams.length > 0 ? (
              <Select value={awayTeam} onValueChange={(v) => setAwayTeam(v ?? "")} required>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner l'équipe" />
                </SelectTrigger>
                <SelectContent>
                  {teams
                    .filter((t) => t.name !== homeTeam)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={awayTeam}
                onChange={(e) => setAwayTeam(e.target.value)}
                required
                placeholder="Nom de l'équipe"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Lieu (stade)</Label>
            <Input
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              required
              placeholder="Stade Municipal"
            />
          </div>

          <div className="space-y-2">
            <Label>Date et heure</Label>
            <Input
              type="datetime-local"
              value={matchDate}
              onChange={(e) => setMatchDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Notes (optionnel)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Informations complémentaires..."
            />
          </div>

          <Button type="submit" className="w-full bg-brand hover:bg-brand/90" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Créer le match"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

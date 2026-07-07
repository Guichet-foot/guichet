"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateMatch } from "@/lib/actions/match-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface MatchEditFormProps {
  matchId: string;
  initialData: {
    homeTeam: string;
    awayTeam: string;
    venue: string;
    matchDate: string;
    notes: string;
  };
  backUrl: string;
}

export function MatchEditForm({ matchId, initialData, backUrl }: MatchEditFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [homeTeam, setHomeTeam] = useState(initialData.homeTeam);
  const [awayTeam, setAwayTeam] = useState(initialData.awayTeam);
  const [venue, setVenue] = useState(initialData.venue);
  const [matchDate, setMatchDate] = useState(initialData.matchDate);
  const [notes, setNotes] = useState(initialData.notes);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!homeTeam.trim() || !awayTeam.trim() || !venue.trim() || !matchDate) {
      toast.error("Remplissez tous les champs obligatoires");
      return;
    }
    setLoading(true);
    const result = await updateMatch(matchId, {
      homeTeam: homeTeam.trim(),
      awayTeam: awayTeam.trim(),
      venue: venue.trim(),
      matchDate: new Date(matchDate).toISOString(),
      notes: notes.trim(),
    });
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Match modifié !");
    router.push(backUrl);
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href={backUrl}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Button>
        </Link>
        <h1 className="text-2xl font-bold font-heading">Modifier le match</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="homeTeam">Équipe domicile *</Label>
              <Input
                id="homeTeam"
                value={homeTeam}
                onChange={(e) => setHomeTeam(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="awayTeam">Équipe visiteur *</Label>
              <Input
                id="awayTeam"
                value={awayTeam}
                onChange={(e) => setAwayTeam(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="venue">Lieu (stade) *</Label>
              <Input
                id="venue"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="matchDate">Date et heure *</Label>
              <Input
                id="matchDate"
                type="datetime-local"
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optionnel)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Informations complémentaires..."
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-brand hover:bg-brand/90"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Enregistrer les modifications"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

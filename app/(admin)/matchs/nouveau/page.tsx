"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createMatch } from "@/lib/actions/match-actions";
import { createClient } from "@/lib/supabase/client";
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
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface TeamOption {
  id: string;
  name: string;
}

export default function NewMatchPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [zoneId, setZoneId] = useState<string>("");
  const [teams, setTeams] = useState<TeamOption[]>([]);

  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [venue, setVenue] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("zone_id")
        .eq("id", user.id)
        .single();

      if (profile?.zone_id) {
        setZoneId(profile.zone_id);

        const { data: teamList } = await supabase
          .from("teams")
          .select("id, name")
          .eq("zone_id", profile.zone_id)
          .order("name");

        if (teamList) setTeams(teamList);
      }
    }
    init();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!zoneId) {
      toast.error("Zone non trouvée");
      return;
    }
    if (homeTeam === awayTeam) {
      toast.error("Les deux équipes doivent être différentes");
      return;
    }
    setLoading(true);

    const result = await createMatch({
      zoneId,
      homeTeam,
      awayTeam,
      venue,
      matchDate: new Date(matchDate).toISOString(),
      notes,
    });

    if (result.error) {
      toast.error(result.error);
      setLoading(false);
      return;
    }

    toast.success("Match créé");
    router.push("/matchs");
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/matchs">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Button>
        </Link>
        <h1 className="text-2xl font-bold font-heading">Nouveau match</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Équipe domicile</Label>
              {teams.length > 0 ? (
                <Select
                  value={homeTeam}
                  onValueChange={(v) => setHomeTeam(v ?? "")}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner l'équipe" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.name}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={homeTeam}
                  onChange={(e) => setHomeTeam(e.target.value)}
                  required
                  placeholder="ASC Ndiarème"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>Équipe visiteur</Label>
              {teams.length > 0 ? (
                <Select
                  value={awayTeam}
                  onValueChange={(v) => setAwayTeam(v ?? "")}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner l'équipe" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams
                      .filter((t) => t.name !== homeTeam)
                      .map((t) => (
                        <SelectItem key={t.id} value={t.name}>
                          {t.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={awayTeam}
                  onChange={(e) => setAwayTeam(e.target.value)}
                  required
                  placeholder="ASC Yeumbeul"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="venue">Lieu (stade)</Label>
              <Input
                id="venue"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                required
                placeholder="Stade Municipal de Saly"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="matchDate">Date et heure</Label>
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
                "Créer le match"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

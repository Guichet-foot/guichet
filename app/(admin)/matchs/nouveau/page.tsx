"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createMatch, getC3TeamsAndZones, getTeamsForZone } from "@/lib/actions/match-actions";
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

/* eslint-disable @typescript-eslint/no-explicit-any */

interface TeamOption {
  id: string;
  name: string;
  zoneId?: string;
  zoneAbbrev?: string;
}

function makeZoneAbbrev(zoneName: string): string {
  return "Z" + zoneName.replace(/^Zone\s+/i, "").replace(/\s+/g, "").toUpperCase();
}

export default function NewMatchPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [zoneId, setZoneId] = useState<string>("");
  const [c3AccountId, setC3AccountId] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamOption[]>([]);

  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");

  const [venue, setVenue] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [notes, setNotes] = useState("");

  const isMultiZone = new Set(teams.map((t) => t.zoneId).filter(Boolean)).size > 1;

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const urlParams = new URLSearchParams(window.location.search);
      const zoneParam = urlParams.get("zone");

      const { data: profile } = await supabase
        .from("profiles")
        .select("zone_id, role, id, allowed_zones")
        .eq("id", user.id)
        .single();

      if (profile?.role === "c3") {
        setC3AccountId(profile.id);

        const { teams: teamList, zones: zoneList, allowedZones } = await getC3TeamsAndZones();

        if (allowedZones.length > 0) {
          const zoneMap = new Map(zoneList.map((z) => [z.id, z.name]));
          setTeams(
            teamList.map((t) => ({
              id: t.id,
              name: t.name,
              zoneId: t.zone_id,
              zoneAbbrev: zoneMap.has(t.zone_id) ? makeZoneAbbrev(zoneMap.get(t.zone_id)!) : "",
            }))
          );
        }
      } else {
        const effectiveZone = zoneParam || profile?.zone_id;
        if (effectiveZone) {
          setZoneId(effectiveZone);
          const teamList = await getTeamsForZone(effectiveZone);
          if (teamList.length > 0) setTeams(teamList);
        }
      }
    }
    init();
  }, []);

  function teamLabel(t: TeamOption): string {
    if (isMultiZone && t.zoneAbbrev) return `${t.name} (${t.zoneAbbrev})`;
    return t.name;
  }

  function resolveTeamName(teamId: string, opponentId: string): string {
    const t = teams.find((x) => x.id === teamId);
    const opp = teams.find((x) => x.id === opponentId);
    if (!t) return teamId;
    const differentZones = t.zoneId && opp?.zoneId && t.zoneId !== opp.zoneId;
    return differentZones ? `${t.name} (${t.zoneAbbrev})` : t.name;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    let finalHomeTeam: string;
    let finalAwayTeam: string;

    if (c3AccountId) {
      if (!homeTeamId || !awayTeamId) { toast.error("Sélectionnez les deux équipes"); return; }
      if (homeTeamId === awayTeamId) { toast.error("Les deux équipes doivent être différentes"); return; }
      finalHomeTeam = resolveTeamName(homeTeamId, awayTeamId);
      finalAwayTeam = resolveTeamName(awayTeamId, homeTeamId);
    } else {
      if (!zoneId && !c3AccountId) { toast.error("Zone non trouvée"); return; }
      if (homeTeam === awayTeam) { toast.error("Les deux équipes doivent être différentes"); return; }
      finalHomeTeam = homeTeam;
      finalAwayTeam = awayTeam;
    }

    setLoading(true);

    const result = await createMatch({
      zoneId: c3AccountId ? null : zoneId,
      c3AccountId,
      homeTeam: finalHomeTeam,
      awayTeam: finalAwayTeam,
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

            {/* Équipe domicile */}
            <div className="space-y-2">
              <Label>Équipe domicile</Label>
              {c3AccountId ? (
                teams.length > 0 ? (
                  <Select value={homeTeamId} onValueChange={(v) => setHomeTeamId(v ?? "")} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner l'équipe" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{teamLabel(t)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} required placeholder="ASC Ndiarème" />
                )
              ) : teams.length > 0 ? (
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
                <Input value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} required placeholder="ASC Ndiarème" />
              )}
            </div>

            {/* Équipe visiteur */}
            <div className="space-y-2">
              <Label>Équipe visiteur</Label>
              {c3AccountId ? (
                teams.length > 0 ? (
                  <Select value={awayTeamId} onValueChange={(v) => setAwayTeamId(v ?? "")} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner l'équipe" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams
                        .filter((t) => t.id !== homeTeamId)
                        .map((t) => (
                          <SelectItem key={t.id} value={t.id}>{teamLabel(t)}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} required placeholder="ASC Yeumbeul" />
                )
              ) : teams.length > 0 ? (
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
                <Input value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} required placeholder="ASC Yeumbeul" />
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
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Créer le match"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

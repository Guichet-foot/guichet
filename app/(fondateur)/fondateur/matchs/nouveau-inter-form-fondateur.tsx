"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getFondateurOdcavAccounts,
  getTeamsForOdcav,
  createOdcavInterMatch,
} from "@/lib/actions/odcav-match-actions";
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

interface OdcavOption { id: string; name: string | null }
interface TeamOption { id: string; name: string; zone_id: string; zone_name: string }

interface Props {
  matchType: "Match Communal" | "Match Départemental";
  backHref: string;
  title: string;
}

export function NouveauInterMatchFondateurForm({ matchType, backHref, title }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [odcavs, setOdcavs] = useState<OdcavOption[]>([]);
  const [selectedOdcavId, setSelectedOdcavId] = useState("");
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);

  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [venue, setVenue] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    getFondateurOdcavAccounts().then(setOdcavs);
  }, []);

  useEffect(() => {
    if (!selectedOdcavId) { setTeams([]); return; }
    setTeamsLoading(true);
    setHomeTeamId("");
    setAwayTeamId("");
    getTeamsForOdcav(selectedOdcavId).then((data) => {
      setTeams(data);
      setTeamsLoading(false);
    });
  }, [selectedOdcavId]);

  const homeTeam = teams.find((t) => t.id === homeTeamId);
  const awayTeam = teams.find((t) => t.id === awayTeamId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOdcavId) { toast.error("Sélectionnez l'ODCAV organisateur"); return; }
    if (!homeTeamId || !awayTeamId) { toast.error("Sélectionnez les deux équipes"); return; }
    if (homeTeamId === awayTeamId) { toast.error("Les deux équipes doivent être différentes"); return; }

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
      odcavId: selectedOdcavId,
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
            {/* ODCAV selector */}
            <div className="space-y-2">
              <Label>ODCAV organisateur</Label>
              <Select value={selectedOdcavId} onValueChange={(v) => setSelectedOdcavId(v ?? "")} required>
                <SelectTrigger>
                  <SelectValue placeholder={odcavs.length === 0 ? "Chargement…" : "Choisir l'ODCAV"} />
                </SelectTrigger>
                <SelectContent>
                  {odcavs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name ?? o.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedOdcavId && teams.length === 0 && !teamsLoading && (
                <p className="text-xs text-amber-600">Cet ODCAV n'a pas encore d'équipes.</p>
              )}
            </div>

            {/* Équipe domicile */}
            <div className="space-y-2">
              <Label>Équipe domicile</Label>
              <Select
                value={homeTeamId}
                onValueChange={(v) => setHomeTeamId(v ?? "")}
                required
              >
                <SelectTrigger disabled={!selectedOdcavId || teamsLoading}>
                  <SelectValue placeholder={teamsLoading ? "Chargement…" : !selectedOdcavId ? "Sélectionnez d'abord l'ODCAV" : "Choisir l'équipe domicile"} />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.zone_name ? `${t.name} (${t.zone_name})` : t.name}
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
              <Select
                value={awayTeamId}
                onValueChange={(v) => setAwayTeamId(v ?? "")}
                required
              >
                <SelectTrigger disabled={!selectedOdcavId || teamsLoading}>
                  <SelectValue placeholder={teamsLoading ? "Chargement…" : !selectedOdcavId ? "Sélectionnez d'abord l'ODCAV" : "Choisir l'équipe visiteur"} />
                </SelectTrigger>
                <SelectContent>
                  {teams
                    .filter((t) => t.id !== homeTeamId)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.zone_name ? `${t.name} (${t.zone_name})` : t.name}
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

            <Button type="submit" className="w-full bg-brand hover:bg-brand/90" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Créer le match"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

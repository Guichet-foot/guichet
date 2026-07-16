"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createOdcavInterMatch, getOdcavTeamsWithZones, getCommunalC3Accounts } from "@/lib/actions/odcav-match-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2, Users } from "lucide-react";
import { TeamSelect } from "./team-select";
import { toast } from "sonner";
import Link from "next/link";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface TeamOption {
  id: string;
  name: string;
  zone_id: string;
  zone_name: string;
}

interface C3Account {
  id: string;
  name: string;
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
  const [c3Accounts, setC3Accounts] = useState<C3Account[]>([]);

  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [venue, setVenue] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedC3Id, setSelectedC3Id] = useState("");

  useEffect(() => {
    getOdcavTeamsWithZones().then((data) => setTeams(data));
    if (matchType === "Match Communal") {
      getCommunalC3Accounts().then((data) => setC3Accounts(data));
    }
  }, [matchType]);

  const homeTeam = teams.find((t) => t.id === homeTeamId);
  const awayTeam = teams.find((t) => t.id === awayTeamId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      c3AccountId: selectedC3Id || undefined,
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
              <TeamSelect
                teams={teams}
                value={homeTeamId}
                onChange={setHomeTeamId}
                placeholder={teams.length === 0 ? "Chargement…" : "Choisir l'équipe domicile"}
              />
              {homeTeam && (
                <p className="text-xs text-muted-foreground">
                  Sur le billet : <strong>{homeTeam.name} ({homeTeam.zone_name})</strong>
                </p>
              )}
            </div>

            {/* Équipe visiteur */}
            <div className="space-y-2">
              <Label>Équipe visiteur</Label>
              <TeamSelect
                teams={teams}
                value={awayTeamId}
                onChange={setAwayTeamId}
                placeholder={teams.length === 0 ? "Chargement…" : "Choisir l'équipe visiteur"}
                excludeId={homeTeamId}
              />
              {awayTeam && (
                <p className="text-xs text-muted-foreground">
                  Sur le billet : <strong>{awayTeam.name} ({awayTeam.zone_name})</strong>
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

            {/* Sélecteur C3 — uniquement pour les matchs communaux */}
            {matchType === "Match Communal" && c3Accounts.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="c3Account" className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Compte C3 (optionnel)
                </Label>
                <select
                  id="c3Account"
                  value={selectedC3Id}
                  onChange={(e) => setSelectedC3Id(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">— Aucun (visible par tous les C3) —</option>
                  {c3Accounts.map((c3) => (
                    <option key={c3.id} value={c3.id}>{c3.name}</option>
                  ))}
                </select>
                {selectedC3Id && (
                  <p className="text-xs text-blue-600">
                    Ce match sera visible uniquement par <strong>{c3Accounts.find(c => c.id === selectedC3Id)?.name}</strong>
                  </p>
                )}
                {!selectedC3Id && (
                  <p className="text-xs text-muted-foreground">
                    Sans sélection, ce match sera visible par tous les comptes C3
                  </p>
                )}
              </div>
            )}

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

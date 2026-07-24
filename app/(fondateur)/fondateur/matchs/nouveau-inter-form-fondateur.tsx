"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getCommunalC3Accounts,
  getFondateurOdcavAccounts,
  getTeamsForOdcav,
  getOdcavTeamsWithZones,
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
interface C3Option    { id: string; name: string }
interface TeamOption  { id: string; name: string; zone_id: string; zone_name: string }

interface Props {
  matchType: "Match Communal" | "Match Départemental";
  backHref: string;
  title: string;
}

export function NouveauInterMatchFondateurForm({ matchType, backHref, title }: Props) {
  const router   = useRouter();
  const isCommunal = matchType === "Match Communal";

  const [loading, setLoading] = useState(false);

  // Communal : liste C3
  const [c3s, setC3s]               = useState<C3Option[]>([]);
  const [selectedC3Id, setSelectedC3Id] = useState("");

  // Départemental : liste ODCAV
  const [odcavs, setOdcavs]               = useState<OdcavOption[]>([]);
  const [selectedOdcavId, setSelectedOdcavId] = useState("");

  // Équipes communes
  const [teams, setTeams]           = useState<TeamOption[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [homeSearch, setHomeSearch] = useState("");
  const [awaySearch, setAwaySearch] = useState("");

  // Champs communs
  const [venue, setVenue]       = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [notes, setNotes]       = useState("");

  // Charger la liste de comptes (C3 ou ODCAV) au montage
  useEffect(() => {
    if (isCommunal) {
      getCommunalC3Accounts().then(setC3s);
    } else {
      getFondateurOdcavAccounts().then(setOdcavs);
    }
  }, [isCommunal]);

  // Charger les équipes quand un organisateur est sélectionné
  const selectedId = isCommunal ? selectedC3Id : selectedOdcavId;
  useEffect(() => {
    if (!selectedId) { setTeams([]); return; }
    setTeamsLoading(true);
    setHomeTeamId("");
    setAwayTeamId("");
    setHomeSearch("");
    setAwaySearch("");
    const load = isCommunal
      ? getOdcavTeamsWithZones()      // fondateur voit toutes les équipes
      : getTeamsForOdcav(selectedOdcavId);
    load.then((data) => { setTeams(data); setTeamsLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const homeTeam = teams.find((t) => t.id === homeTeamId);
  const awayTeam = teams.find((t) => t.id === awayTeamId);

  const filteredHome = teams.filter((t) =>
    `${t.name} ${t.zone_name}`.toLowerCase().includes(homeSearch.toLowerCase())
  );
  const filteredAway = teams
    .filter((t) => t.id !== homeTeamId)
    .filter((t) => `${t.name} ${t.zone_name}`.toLowerCase().includes(awaySearch.toLowerCase()));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isCommunal && !selectedC3Id) { toast.error("Sélectionnez le C3 organisateur"); return; }
    if (!isCommunal && !selectedOdcavId) { toast.error("Sélectionnez l'ODCAV organisateur"); return; }
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
      ...(isCommunal
        ? { c3AccountId: selectedC3Id }
        : { odcavId: selectedOdcavId }),
    });
    setLoading(false);

    if (result.error) { toast.error(result.error); return; }
    toast.success("Match créé");
    router.push(backHref);
  }

  const orgPlaceholder = isCommunal
    ? (c3s.length === 0 ? "Chargement…" : "Choisir le C3")
    : (odcavs.length === 0 ? "Chargement…" : "Choisir l'ODCAV");

  const teamPlaceholder = teamsLoading
    ? "Chargement…"
    : !selectedId
      ? isCommunal ? "Sélectionnez d'abord le C3" : "Sélectionnez d'abord l'ODCAV"
      : undefined;

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

            {/* Organisateur selector */}
            <div className="space-y-2">
              <Label>{isCommunal ? "C3 organisateur" : "ODCAV organisateur"}</Label>
              {isCommunal ? (
                <Select value={selectedC3Id} onValueChange={(v) => setSelectedC3Id(v ?? "")} required>
                  <SelectTrigger>
                    <SelectValue placeholder={orgPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {c3s.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={selectedOdcavId} onValueChange={(v) => setSelectedOdcavId(v ?? "")} required>
                  <SelectTrigger>
                    <SelectValue placeholder={orgPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {odcavs.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.name ?? o.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {selectedId && teams.length === 0 && !teamsLoading && (
                <p className="text-xs text-amber-600">
                  {isCommunal ? "Aucune équipe disponible." : "Cet ODCAV n'a pas encore d'équipes."}
                </p>
              )}
            </div>

            {/* Équipe domicile */}
            <div className="space-y-2">
              <Label>Équipe domicile</Label>
              <Select
                value={homeTeamId}
                onValueChange={(v) => { setHomeTeamId(v ?? ""); setHomeSearch(""); }}
                required
              >
                <SelectTrigger disabled={!selectedId || teamsLoading}>
                  <SelectValue placeholder={teamPlaceholder ?? "Choisir l'équipe domicile"} />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2 sticky top-0 bg-popover z-10">
                    <Input
                      placeholder="Rechercher une équipe…"
                      value={homeSearch}
                      onChange={(e) => setHomeSearch(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      className="h-8"
                    />
                  </div>
                  {filteredHome.length === 0 ? (
                    <div className="py-2 px-3 text-sm text-muted-foreground">Aucun résultat</div>
                  ) : filteredHome.map((t) => (
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
                onValueChange={(v) => { setAwayTeamId(v ?? ""); setAwaySearch(""); }}
                required
              >
                <SelectTrigger disabled={!selectedId || teamsLoading}>
                  <SelectValue placeholder={teamPlaceholder ?? "Choisir l'équipe visiteur"} />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2 sticky top-0 bg-popover z-10">
                    <Input
                      placeholder="Rechercher une équipe…"
                      value={awaySearch}
                      onChange={(e) => setAwaySearch(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      className="h-8"
                    />
                  </div>
                  {filteredAway.length === 0 ? (
                    <div className="py-2 px-3 text-sm text-muted-foreground">Aucun résultat</div>
                  ) : filteredAway.map((t) => (
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

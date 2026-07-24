"use client";

import { useState, useEffect, useRef } from "react";
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
import { ArrowLeft, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface OdcavOption { id: string; name: string | null }
interface C3Option    { id: string; name: string }
interface TeamOption  { id: string; name: string; zone_id: string; zone_name: string }

// ── Combobox cherchable pour les équipes ────────────────────────────────────
function TeamSelect({
  teams,
  value,
  onChange,
  placeholder,
  disabled,
  exclude,
}: {
  teams: TeamOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  disabled?: boolean;
  exclude?: string;
}) {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState("");
  const ref                 = useRef<HTMLDivElement>(null);
  const inputRef            = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const selected = teams.find((t) => t.id === value);
  const filtered = teams
    .filter((t) => !exclude || t.id !== exclude)
    .filter((t) =>
      search === "" ||
      `${t.name} ${t.zone_name}`.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={selected ? "text-foreground" : "text-muted-foreground truncate"}>
          {selected
            ? (selected.zone_name ? `${selected.name} (${selected.zone_name})` : selected.name)
            : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 rounded-md border border-border bg-popover text-popover-foreground shadow-md">
          {/* Champ de recherche */}
          <div className="p-2 border-b border-border">
            <input
              ref={inputRef}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="Rechercher une équipe…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") { setOpen(false); setSearch(""); }
              }}
            />
          </div>
          {/* Liste */}
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">Aucun résultat</div>
            ) : (
              filtered.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { onChange(t.id); setOpen(false); setSearch(""); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground ${
                    t.id === value ? "bg-accent/50 font-medium" : ""
                  }`}
                >
                  {t.name}{t.zone_name ? ` (${t.zone_name})` : ""}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Formulaire principal ────────────────────────────────────────────────────
interface Props {
  matchType: "Match Communal" | "Match Départemental";
  backHref: string;
  title: string;
}

export function NouveauInterMatchFondateurForm({ matchType, backHref, title }: Props) {
  const router     = useRouter();
  const isCommunal = matchType === "Match Communal";

  const [loading, setLoading] = useState(false);

  const [c3s, setC3s]                     = useState<C3Option[]>([]);
  const [selectedC3Id, setSelectedC3Id]   = useState("");
  const [odcavs, setOdcavs]               = useState<OdcavOption[]>([]);
  const [selectedOdcavId, setSelectedOdcavId] = useState("");

  const [teams, setTeams]           = useState<TeamOption[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");

  const [venue, setVenue]         = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [notes, setNotes]         = useState("");

  useEffect(() => {
    if (isCommunal) getCommunalC3Accounts().then(setC3s);
    else            getFondateurOdcavAccounts().then(setOdcavs);
  }, [isCommunal]);

  const selectedId = isCommunal ? selectedC3Id : selectedOdcavId;
  useEffect(() => {
    if (!selectedId) { setTeams([]); return; }
    setTeamsLoading(true);
    setHomeTeamId("");
    setAwayTeamId("");
    const load = isCommunal ? getOdcavTeamsWithZones() : getTeamsForOdcav(selectedOdcavId);
    load.then((data) => { setTeams(data); setTeamsLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const homeTeam = teams.find((t) => t.id === homeTeamId);
  const awayTeam = teams.find((t) => t.id === awayTeamId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isCommunal && !selectedC3Id)   { toast.error("Sélectionnez le C3 organisateur"); return; }
    if (!isCommunal && !selectedOdcavId) { toast.error("Sélectionnez l'ODCAV organisateur"); return; }
    if (!homeTeamId || !awayTeamId)    { toast.error("Sélectionnez les deux équipes"); return; }
    if (homeTeamId === awayTeamId)     { toast.error("Les deux équipes doivent être différentes"); return; }

    setLoading(true);
    const result = await createOdcavInterMatch({
      homeTeam:     homeTeam!.name,
      homeTeamZone: homeTeam!.zone_name,
      awayTeam:     awayTeam!.name,
      awayTeamZone: awayTeam!.zone_name,
      matchType,
      venue,
      matchDate: new Date(matchDate).toISOString(),
      notes,
      ...(isCommunal ? { c3AccountId: selectedC3Id } : { odcavId: selectedOdcavId }),
    });
    setLoading(false);

    if (result.error) { toast.error(result.error); return; }
    toast.success("Match créé");
    router.push(backHref);
  }

  const teamSelectDisabled = !selectedId || teamsLoading;
  const teamPlaceholder = teamsLoading
    ? "Chargement…"
    : !selectedId
      ? (isCommunal ? "Sélectionnez d'abord le C3" : "Sélectionnez d'abord l'ODCAV")
      : "Choisir l'équipe";

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

            {/* Organisateur */}
            <div className="space-y-2">
              <Label>{isCommunal ? "C3 organisateur" : "ODCAV organisateur"}</Label>
              {isCommunal ? (
                <Select value={selectedC3Id} onValueChange={(v) => setSelectedC3Id(v ?? "")} required>
                  <SelectTrigger>
                    <SelectValue placeholder={c3s.length === 0 ? "Chargement…" : "Choisir le C3"} />
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
                    <SelectValue placeholder={odcavs.length === 0 ? "Chargement…" : "Choisir l'ODCAV"} />
                  </SelectTrigger>
                  <SelectContent>
                    {odcavs.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.name ?? o.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {selectedId && teams.length === 0 && !teamsLoading && (
                <p className="text-xs text-amber-600">Aucune équipe disponible.</p>
              )}
            </div>

            {/* Équipe domicile */}
            <div className="space-y-2">
              <Label>Équipe domicile</Label>
              <TeamSelect
                teams={teams}
                value={homeTeamId}
                onChange={setHomeTeamId}
                placeholder={teamPlaceholder}
                disabled={teamSelectDisabled}
                exclude={awayTeamId}
              />
              {homeTeam && (
                <p className="text-xs text-muted-foreground">
                  Zone : {homeTeam.zone_name} — sur le billet : <strong>{homeTeam.name} ({homeTeam.zone_name})</strong>
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
                placeholder={teamPlaceholder}
                disabled={teamSelectDisabled}
                exclude={homeTeamId}
              />
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

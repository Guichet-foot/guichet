"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createMatch } from "@/lib/actions/match-actions";
import { applyTemplatesToMatch } from "@/lib/actions/ticket-template-actions";
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
import { ArrowLeft, Check, Loader2, Ticket } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { formatFCFA } from "@/lib/format";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface TeamOption {
  id: string;
  name: string;
}

interface TemplateOption {
  id: string;
  name: string;
  price: number;
  default_quantity: number;
  color: string;
}

export default function NewMatchPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [zoneId, setZoneId] = useState<string>("");
  const [c3AccountId, setC3AccountId] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());

  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [venue, setVenue] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [notes, setNotes] = useState("");

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
        const allowedZones: string[] = profile.allowed_zones ?? [];
        let teamQuery = supabase.from("teams").select("id, name").order("name");
        if (allowedZones.length > 0) {
          teamQuery = teamQuery.in("zone_id", allowedZones);
        } else {
          // Aucune zone assignée : pas d'équipes
          teamQuery = teamQuery.eq("zone_id", "00000000-0000-0000-0000-000000000000");
        }
        const [{ data: teamList }, { data: templateList }] = await Promise.all([
          teamQuery,
          supabase.from("ticket_templates").select("id, name, price, default_quantity, color")
            .eq("c3_account_id", profile.id).order("price"),
        ]);
        if (teamList) setTeams(teamList);
        if (templateList) setTemplates(templateList);
      } else {
        const effectiveZone = zoneParam || profile?.zone_id;
        if (effectiveZone) {
          setZoneId(effectiveZone);
          const [{ data: teamList }, { data: templateList }] = await Promise.all([
            supabase.from("teams").select("id, name").eq("zone_id", effectiveZone).order("name"),
            supabase.from("ticket_templates").select("id, name, price, default_quantity, color").eq("zone_id", effectiveZone).order("price"),
          ]);
          if (teamList) setTeams(teamList);
          if (templateList) setTemplates(templateList);
        }
      }
    }
    init();
  }, []);

  function toggleTemplate(id: string) {
    setSelectedTemplates((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllTemplates() {
    if (selectedTemplates.size === templates.length) {
      setSelectedTemplates(new Set());
    } else {
      setSelectedTemplates(new Set(templates.map((t) => t.id)));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!zoneId && !c3AccountId) { toast.error("Zone non trouvée"); return; }
    if (homeTeam === awayTeam) { toast.error("Les deux équipes doivent être différentes"); return; }
    setLoading(true);

    const result = await createMatch({
      zoneId: c3AccountId ? null : zoneId,
      c3AccountId,
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

    // Apply selected ticket templates if any
    if (selectedTemplates.size > 0 && result.matchId) {
      const applyResult = await applyTemplatesToMatch(result.matchId, Array.from(selectedTemplates));
      if (applyResult.error) {
        toast.warning(`Match créé mais erreur billets : ${applyResult.error}`);
      } else {
        toast.success(`Match créé avec ${applyResult.count} catégorie(s) de billets`);
      }
    } else {
      toast.success("Match créé");
    }

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
                  placeholder="ASC Ndiarème"
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

            {/* Ticket category selection */}
            {templates.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Ticket className="h-4 w-4 text-brand" />
                    <Label className="text-sm font-semibold">Catégories de billets</Label>
                  </div>
                  <button
                    type="button"
                    onClick={selectAllTemplates}
                    className="text-xs text-brand hover:underline"
                  >
                    {selectedTemplates.size === templates.length ? "Tout désélectionner" : "Tout sélectionner"}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground -mt-1">
                  Sélectionnez les catégories à appliquer à ce match
                </p>
                <div className="space-y-2">
                  {templates.map((t) => {
                    const isSelected = selectedTemplates.has(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleTemplate(t.id)}
                        className={`w-full text-left rounded-lg border-2 p-3 transition-colors ${
                          isSelected
                            ? "border-brand bg-brand/5"
                            : "border-border hover:border-brand/30"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-2.5 h-8 rounded-sm shrink-0"
                              style={{ backgroundColor: t.color || "#0D5C3F" }}
                            />
                            <div>
                              <p className="font-semibold text-sm">{t.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatFCFA(t.price)} — Qté : {t.default_quantity}
                              </p>
                            </div>
                          </div>
                          {isSelected && <Check className="h-4 w-4 text-brand shrink-0" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {selectedTemplates.size > 0 && (
                  <p className="text-xs text-brand font-medium">
                    {selectedTemplates.size} catégorie(s) sélectionnée(s)
                  </p>
                )}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-brand hover:bg-brand/90"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : selectedTemplates.size > 0 ? (
                `Créer le match avec ${selectedTemplates.size} catégorie(s)`
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

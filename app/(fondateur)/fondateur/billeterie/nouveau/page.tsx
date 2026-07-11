"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAllMatchesForBilleterie, createBilleterie } from "@/lib/actions/billeterie-actions";
import type { MatchOption } from "@/lib/actions/billeterie-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Check, Trophy } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { formatFCFA } from "@/lib/format";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

/* eslint-disable @typescript-eslint/no-explicit-any */

function matchLabel(m: MatchOption): string {
  const home = m.home_team_zone ? `${m.home_team} (${m.home_team_zone})` : m.home_team;
  const away = m.away_team_zone ? `${m.away_team} (${m.away_team_zone})` : m.away_team;
  return `${home} vs ${away}`;
}

function statusBadge(_status: string) {
  return <Badge variant="outline" className="text-xs">Programmé</Badge>;
}

export default function FondateurNouveauBilletteriePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<MatchOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  useEffect(() => {
    getAllMatchesForBilleterie().then((data) => setMatches(data));
  }, []);

  function toggleMatch(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selectedIds.size === matches.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(matches.map((m) => m.id)));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedIds.size === 0) { toast.error("Sélectionnez au moins un match"); return; }
    const p = parseInt(price);
    if (isNaN(p) || p < 0) { toast.error("Prix invalide"); return; }

    setLoading(true);
    const result = await createBilleterie({
      name,
      matchIds: Array.from(selectedIds),
      price: p,
    });
    setLoading(false);

    if (result.error) { toast.error(result.error); return; }

    toast.success("Pass créé");
    router.push(`/fondateur/billeterie/${result.billeterieId}`);
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/fondateur/billeterie">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Button>
        </Link>
        <h1 className="text-2xl font-bold font-heading">Nouveau pass multi-matchs</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom du pass</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Ex: Pass Phase de Poules"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Prix (FCFA)</Label>
              <Input
                id="price"
                type="number"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                placeholder="2000"
              />
              {price && !isNaN(parseInt(price)) && (
                <p className="text-xs text-muted-foreground">{formatFCFA(parseInt(price))}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-semibold">Matchs inclus dans le pass</Label>
                {selectedIds.size > 0 && (
                  <p className="text-xs text-brand mt-0.5">{selectedIds.size} match{selectedIds.size !== 1 ? "s" : ""} sélectionné{selectedIds.size !== 1 ? "s" : ""}</p>
                )}
              </div>
              {matches.length > 0 && (
                <button type="button" onClick={selectAll} className="text-xs text-brand hover:underline">
                  {selectedIds.size === matches.length ? "Tout désélectionner" : "Tout sélectionner"}
                </button>
              )}
            </div>

            {matches.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Trophy className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">Aucun match programmé disponible</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {matches.map((m) => {
                  const isSelected = selectedIds.has(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMatch(m.id)}
                      className={`w-full text-left rounded-lg border-2 p-3 transition-colors ${
                        isSelected ? "border-brand bg-brand/5" : "border-border hover:border-brand/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{matchLabel(m)}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {format(new Date(m.match_date), "EEE d MMM yyyy · HH'h'mm", { locale: fr })}
                            {m.match_type && ` · ${m.match_type}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {statusBadge(m.status)}
                          {isSelected && <Check className="h-4 w-4 text-brand" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Button
          type="submit"
          className="w-full bg-brand hover:bg-brand/90"
          disabled={loading || selectedIds.size === 0}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            `Créer le pass — ${selectedIds.size} match${selectedIds.size !== 1 ? "s" : ""}`
          )}
        </Button>
      </form>
    </div>
  );
}

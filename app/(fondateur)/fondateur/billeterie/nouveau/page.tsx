"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getAllMatchesForBilleterie,
  getAllMatchIdsForScope,
  getZonesForBilleterie,
  createBilleterie,
} from "@/lib/actions/billeterie-actions";
import type { MatchOption, BilCategory } from "@/lib/actions/billeterie-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Check, Trophy, Plus, Trash2, Layers, MapPin, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { formatFCFA, fmtZone } from "@/lib/format";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

/* eslint-disable @typescript-eslint/no-explicit-any */

function matchLabel(m: MatchOption): string {
  const home = m.home_team_zone ? `${m.home_team} (${fmtZone(m.home_team_zone)})` : m.home_team;
  const away = m.away_team_zone ? `${m.away_team} (${fmtZone(m.away_team_zone)})` : m.away_team;
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
  const [multiCat, setMultiCat] = useState(false);
  const [categories, setCategories] = useState<BilCategory[]>([{ name: "", price: 0 }]);

  // Mode : "matches" (sélection manuelle) | "zone" (par zone ou compte)
  const [scopeMode, setScopeMode] = useState<"matches" | "zone">("matches");
  const [zones, setZones] = useState<{ id: string; name: string }[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [zoneMatchIds, setZoneMatchIds] = useState<string[] | null>(null);
  const [loadingZone, setLoadingZone] = useState(false);

  useEffect(() => {
    getAllMatchesForBilleterie().then((data) => setMatches(data));
  }, []);

  useEffect(() => {
    if (scopeMode === "zone" && zones.length === 0) {
      getZonesForBilleterie().then((data) => setZones(data));
    }
  }, [scopeMode, zones.length]);

  useEffect(() => {
    if (scopeMode === "zone" && selectedZoneId) {
      setLoadingZone(true);
      setZoneMatchIds(null);
      getAllMatchIdsForScope(selectedZoneId).then((ids) => {
        setZoneMatchIds(ids);
        setLoadingZone(false);
      });
    }
  }, [scopeMode, selectedZoneId]);

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

  function addCategory() {
    setCategories((prev) => [...prev, { name: "", price: 0 }]);
  }

  function removeCategory(idx: number) {
    setCategories((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateCategory(idx: number, field: "name" | "price", value: string) {
    setCategories((prev) =>
      prev.map((c, i) =>
        i === idx
          ? { ...c, [field]: field === "price" ? (parseInt(value) || 0) : value }
          : c
      )
    );
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();

    if (multiCat) {
      if (categories.length === 0) { toast.error("Ajoutez au moins une catégorie"); return; }
      if (categories.some((c) => !c.name.trim())) { toast.error("Chaque catégorie doit avoir un nom"); return; }
      if (categories.some((c) => isNaN(c.price) || c.price < 0)) { toast.error("Prix invalide dans une catégorie"); return; }
    } else {
      const p = parseInt(price);
      if (isNaN(p) || p < 0) { toast.error("Prix invalide"); return; }
    }

    let matchIds: string[];
    if (scopeMode === "zone") {
      if (!selectedZoneId) { toast.error("Sélectionnez une zone"); return; }
      matchIds = zoneMatchIds || [];
    } else {
      matchIds = Array.from(selectedIds);
    }

    setLoading(true);
    const result = await createBilleterie({
      name,
      matchIds,
      price: multiCat ? 0 : parseInt(price),
      categories: multiCat ? categories : undefined,
      showMatchesOnTicket: scopeMode !== "zone",
    });
    setLoading(false);

    if (result.error) { toast.error(result.error); return; }

    toast.success("Pass créé");
    router.push(`/fondateur/billeterie/${result.billeterieId}`);
  }

  const selectedZone = zones.find((z) => z.id === selectedZoneId);
  const canSubmit =
    scopeMode === "matches"
      ? selectedIds.size > 0
      : !!selectedZoneId && zoneMatchIds !== null;

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
        {/* Infos générales */}
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

            {/* Toggle multi-catégories */}
            <div className="flex items-center gap-3 rounded-lg border p-3 bg-muted/30">
              <button
                type="button"
                role="switch"
                aria-checked={multiCat}
                onClick={() => setMultiCat((v) => !v)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  multiCat ? "bg-brand" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg transform transition-transform ${
                    multiCat ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-brand" />
                  Multi-catégories
                </p>
                <p className="text-xs text-muted-foreground">
                  Plusieurs prix différents pour les mêmes matchs (ex: Tribune 1 000 FCFA, Populaire 500 FCFA)
                </p>
              </div>
            </div>

            {/* Prix unique */}
            {!multiCat && (
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
            )}

            {/* Catégories multiples */}
            {multiCat && (
              <div className="space-y-3">
                <Label>Catégories de billets</Label>
                <div className="space-y-2">
                  {categories.map((cat, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={cat.name}
                        onChange={(e) => updateCategory(idx, "name", e.target.value)}
                        placeholder="Ex: Tribune, Populaire…"
                        className="flex-1"
                        required={multiCat}
                      />
                      <Input
                        type="number"
                        min="0"
                        value={cat.price || ""}
                        onChange={(e) => updateCategory(idx, "price", e.target.value)}
                        placeholder="Prix FCFA"
                        className="w-32"
                        required={multiCat}
                      />
                      {categories.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0 text-danger shrink-0"
                          onClick={() => removeCategory(idx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                {categories.length > 0 && categories.every((c) => c.name && c.price >= 0) && (
                  <div className="text-xs text-muted-foreground space-y-0.5 bg-muted/40 rounded p-2">
                    {categories.map((c, i) => (
                      <p key={i}>{c.name} : {formatFCFA(c.price)}</p>
                    ))}
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCategory}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter une catégorie
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Périmètre */}
        <Card>
          <CardContent className="pt-5 space-y-3">
            {/* Toggle Par matchs / Par zone */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScopeMode("matches")}
                className={`rounded-lg border-2 p-3 text-sm font-medium transition-colors text-left ${
                  scopeMode === "matches" ? "border-brand bg-brand/5 text-brand" : "border-border text-muted-foreground hover:border-brand/30"
                }`}
              >
                <Trophy className="h-4 w-4 mb-1" />
                Matchs spécifiques
                <p className="text-xs font-normal mt-0.5 text-muted-foreground">Sélectionner des matchs</p>
              </button>
              <button
                type="button"
                onClick={() => setScopeMode("zone")}
                className={`rounded-lg border-2 p-3 text-sm font-medium transition-colors text-left ${
                  scopeMode === "zone" ? "border-brand bg-brand/5 text-brand" : "border-border text-muted-foreground hover:border-brand/30"
                }`}
              >
                <MapPin className="h-4 w-4 mb-1" />
                Par zone / compte
                <p className="text-xs font-normal mt-0.5 text-muted-foreground">Sans sélectionner les matchs</p>
              </button>
            </div>

            {/* Mode : matchs spécifiques */}
            {scopeMode === "matches" && (
              <>
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
              </>
            )}

            {/* Mode : par zone */}
            {scopeMode === "zone" && (
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Zone ou compte concerné</Label>

                {/* Sélecteur de zone */}
                <div className="relative">
                  <select
                    value={selectedZoneId}
                    onChange={(e) => setSelectedZoneId(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
                  >
                    <option value="">— Choisir une zone —</option>
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>{z.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>

                {/* Résumé après sélection */}
                {selectedZone && (
                  <div className="rounded-lg border border-brand/30 bg-brand/5 p-4 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-brand shrink-0" />
                      <p className="text-sm font-semibold text-brand">{selectedZone.name}</p>
                    </div>
                    {loadingZone ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Chargement des matchs…
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground">
                          {zoneMatchIds && zoneMatchIds.length > 0
                            ? `${zoneMatchIds.length} match${zoneMatchIds.length !== 1 ? "s" : ""} existant${zoneMatchIds.length !== 1 ? "s" : ""} inclus`
                            : "Aucun match existant pour cette zone"}
                          {" — les futurs matchs s'ajouteront automatiquement"}
                        </p>
                        <p className="text-xs font-medium text-amber-700">
                          Les matchs ne seront pas affichés sur le billet imprimé.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Button
          type="submit"
          className="w-full bg-brand hover:bg-brand/90"
          disabled={loading || !canSubmit}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : scopeMode === "zone" && selectedZone ? (
            `Créer le pass — ${selectedZone.name}`
          ) : scopeMode === "zone" ? (
            "Créer le pass"
          ) : (
            `Créer le pass — ${selectedIds.size} match${selectedIds.size !== 1 ? "s" : ""}`
          )}
        </Button>
      </form>
    </div>
  );
}

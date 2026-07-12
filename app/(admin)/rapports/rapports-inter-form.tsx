"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2, Download, Calendar, Trophy } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface MatchOption {
  id: string;
  home_team: string;
  away_team: string;
  match_date: string;
}

interface Props {
  matchType: "Match Communal" | "Match Départemental";
  matches: MatchOption[];
}

export function RapportsInterForm({ matchType, matches }: Props) {
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState("complet");
  const [matchId, setMatchId] = useState("all");
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  const isMatchReport = reportType === "par_match";

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await fetch("/api/reports/inter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchType,
          reportType,
          matchId: isMatchReport ? (matchId === "all" ? null : matchId) : null,
          startDate: isMatchReport ? null : startDate,
          endDate: isMatchReport ? null : endDate,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Erreur lors de la génération");
        setLoading(false);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const label = matchType === "Match Communal" ? "communal" : "departemental";
      a.download = `rapport-${label}-${isMatchReport ? (matchId === "all" ? "tous" : matchId.slice(0, 8)) : startDate}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Rapport téléchargé");
    } catch {
      toast.error("Erreur réseau");
    }
    setLoading(false);
  }

  const badgeColor = matchType === "Match Communal"
    ? "bg-blue-100 text-blue-800 border-blue-200"
    : "bg-purple-100 text-purple-800 border-purple-200";

  return (
    <div className="space-y-4">
      {/* Match count summary */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/40">
        <Trophy className="h-5 w-5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{matches.length} match{matches.length !== 1 ? "s" : ""} disponible{matches.length !== 1 ? "s" : ""}</p>
          <p className="text-xs text-muted-foreground truncate">
            {matchType === "Match Communal" ? "Matchs communaux de votre ODCAV" : "Matchs départementaux de votre ODCAV"}
          </p>
        </div>
        <Badge variant="outline" className={`text-xs shrink-0 ${badgeColor}`}>
          {matchType === "Match Communal" ? "Communal" : "Départemental"}
        </Badge>
      </div>

      <Card className="rounded-2xl shadow-sm border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5 text-brand" />
            Générer un rapport PDF
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Report type */}
          <div className="space-y-2">
            <Label>Type de rapport</Label>
            <Select value={reportType} onValueChange={(v) => setReportType(v ?? "complet")}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="complet">Rapport complet (période)</SelectItem>
                <SelectItem value="recettes">Recettes uniquement</SelectItem>
                <SelectItem value="par_match">Rapport par match</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isMatchReport ? (
            /* === PAR MATCH === */
            <div className="space-y-3 border border-brand/20 bg-brand/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="h-4 w-4 text-brand" />
                <p className="text-sm font-medium text-brand">Sélectionnez un match</p>
              </div>
              {matches.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun match disponible</p>
              ) : (
                <Select value={matchId} onValueChange={(v) => setMatchId(v ?? "all")}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Choisir un match" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les matchs</SelectItem>
                    {matches.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <span className="font-medium">{m.home_team} vs {m.away_team}</span>
                        <span className="text-muted-foreground ml-2 text-xs">
                          — {format(new Date(m.match_date), "d MMM yyyy", { locale: fr })}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ) : (
            /* === PÉRIODE === */
            <div className="space-y-3 border border-border/40 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Période</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Date début</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Date fin</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-11"
                  />
                </div>
              </div>
            </div>
          )}

          <Button
            type="button"
            onClick={handleGenerate}
            className="w-full h-12 bg-brand hover:bg-brand/90 text-white font-semibold"
            disabled={loading || (isMatchReport && matches.length === 0)}
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Download className="h-5 w-5 mr-2" />
                Télécharger le PDF
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Match list preview */}
      {matches.length > 0 && (
        <Card className="rounded-2xl shadow-sm border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">Matchs disponibles</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/40">
              {matches.slice(0, 8).map((m) => (
                <div key={m.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{m.home_team} vs {m.away_team}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 ml-3">
                    {format(new Date(m.match_date), "d MMM yyyy", { locale: fr })}
                  </span>
                </div>
              ))}
              {matches.length > 8 && (
                <div className="px-4 py-2 text-xs text-muted-foreground text-center">
                  +{matches.length - 8} autres matchs
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

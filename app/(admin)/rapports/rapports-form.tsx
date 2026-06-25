"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Loader2, Download } from "lucide-react";
import { toast } from "sonner";

interface MatchOption {
  id: string;
  home_team: string;
  away_team: string;
}

export function RapportsForm({ zoneId }: { zoneId: string | null }) {
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<MatchOption[]>([]);
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [reportType, setReportType] = useState("complet");
  const [matchId, setMatchId] = useState("all");

  useEffect(() => {
    async function fetchMatches() {
      if (!zoneId) return;
      const supabase = createClient();
      const { data } = await supabase
        .from("matches")
        .select("id, home_team, away_team")
        .eq("zone_id", zoneId)
        .order("match_date", { ascending: false });
      if (data) setMatches(data);
    }
    fetchMatches();
  }, [zoneId]);

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await fetch("/api/reports/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate,
          endDate,
          reportType,
          matchId: matchId === "all" ? null : matchId,
          zoneId,
        }),
      });

      if (!res.ok) {
        toast.error("Erreur lors de la génération");
        setLoading(false);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rapport-${reportType}-${startDate}-${endDate}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Rapport téléchargé");
    } catch {
      toast.error("Erreur réseau");
    }
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Générer un rapport
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Date début</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Date fin</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Match (optionnel)</Label>
          <Select value={matchId} onValueChange={(v) => setMatchId(v ?? "all")}>
            <SelectTrigger><SelectValue placeholder="Tous les matchs" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les matchs</SelectItem>
              {matches.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.home_team} vs {m.away_team}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Type de rapport</Label>
          <Select value={reportType} onValueChange={(v) => setReportType(v ?? "complet")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="complet">Rapport complet</SelectItem>
              <SelectItem value="recettes">Recettes uniquement</SelectItem>
              <SelectItem value="depenses">Dépenses uniquement</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="button" onClick={handleGenerate} className="w-full h-12 bg-brand hover:bg-brand/90" disabled={loading}>
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Download className="h-5 w-5 mr-2" />Générer le PDF</>}
        </Button>
      </CardContent>
    </Card>
  );
}

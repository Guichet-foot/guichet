"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Loader2, Download } from "lucide-react";
import { toast } from "sonner";

interface MatchOption {
  id: string;
  home_team: string;
  away_team: string;
  match_date: string;
}

export default function RapportsPage() {
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<MatchOption[]>([]);
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0]
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [reportType, setReportType] = useState("complet");
  const [matchId, setMatchId] = useState("all");

  useEffect(() => {
    async function fetchMatches() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("zone_id")
        .eq("id", user.id)
        .single();

      let query = supabase
        .from("matches")
        .select("id, home_team, away_team, match_date")
        .order("match_date", { ascending: false });

      if (profile?.zone_id) {
        query = query.eq("zone_id", profile.zone_id);
      }

      const { data } = await query;
      if (data) setMatches(data);
    }
    fetchMatches();
  }, []);

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
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold font-heading">Rapports PDF</h1>

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
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Date fin</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Match (optionnel)</Label>
            <Select value={matchId} onValueChange={(v) => setMatchId(v ?? "all")}>
              <SelectTrigger>
                <SelectValue placeholder="Tous les matchs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les matchs</SelectItem>
                {matches.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.home_team} vs {m.away_team}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Type de rapport</Label>
            <Select value={reportType} onValueChange={(v) => setReportType(v ?? "complet")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="complet">Rapport complet</SelectItem>
                <SelectItem value="recettes">Recettes uniquement</SelectItem>
                <SelectItem value="depenses">Dépenses uniquement</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleGenerate}
            className="w-full h-12 bg-brand hover:bg-brand/90"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Download className="h-5 w-5 mr-2" />
                Générer le PDF
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

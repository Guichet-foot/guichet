"use client";

import { useState } from "react";
import {
  updateMatchResult,
  updateTournamentMatch,
} from "@/lib/actions/tournament-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { formatDateShort } from "@/lib/format";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface CalendrierTabProps {
  tournamentId: string;
  matches: any[];
}

export function CalendrierTab({ tournamentId, matches }: CalendrierTabProps) {
  const [scores, setScores] = useState<
    Record<string, { home: string; away: string }>
  >({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<Record<string, string>>({});
  const [editingVenue, setEditingVenue] = useState<Record<string, string>>({});

  function setScore(matchId: string, side: "home" | "away", value: string) {
    setScores((prev) => ({
      ...prev,
      [matchId]: { ...prev[matchId], [side]: value },
    }));
  }

  async function handleSaveResult(matchId: string) {
    const s = scores[matchId];
    if (!s || s.home === "" || s.away === "") {
      toast.error("Entrez les deux scores");
      return;
    }
    setLoadingId(matchId);
    const result = await updateMatchResult(
      matchId,
      parseInt(s.home),
      parseInt(s.away),
      tournamentId
    );
    if (result.error) toast.error(result.error);
    else toast.success("Résultat enregistré");
    setLoadingId(null);
  }

  async function handleSaveDetails(matchId: string) {
    const data: { match_date?: string; venue?: string } = {};
    if (editingDate[matchId]) data.match_date = new Date(editingDate[matchId]).toISOString();
    if (editingVenue[matchId]) data.venue = editingVenue[matchId];
    if (Object.keys(data).length === 0) return;

    setLoadingId(`d-${matchId}`);
    const result = await updateTournamentMatch(matchId, data, tournamentId);
    if (result.error) toast.error(result.error);
    else toast.success("Match mis à jour");
    setLoadingId(null);
  }

  // Group matches by group name
  const byGroup: Record<string, any[]> = {};
  matches.forEach((m: any) => {
    const gName = m.group?.name || "Sans poule";
    if (!byGroup[gName]) byGroup[gName] = [];
    byGroup[gName].push(m);
  });

  if (matches.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-8">
        Aucun match généré. Allez dans l&apos;onglet Poules pour générer les
        matchs.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(byGroup).map(([groupName, groupMatches]) => (
        <div key={groupName} className="space-y-3">
          <h3 className="font-semibold text-lg font-heading">{groupName}</h3>
          {groupMatches.map((m: any) => (
            <Card key={m.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <Badge
                    variant="secondary"
                    className="text-xs"
                  >
                    J{m.journee}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className={
                      m.status === "termine"
                        ? "bg-green-100 text-green-800"
                        : "bg-blue-100 text-blue-800"
                    }
                  >
                    {m.status === "termine" ? "Terminé" : "Programmé"}
                  </Badge>
                </div>

                <div className="flex items-center justify-center gap-3 text-center">
                  <span className="font-semibold flex-1 text-right">
                    {m.home_team?.name}
                  </span>

                  {m.status === "termine" ? (
                    <span className="text-2xl font-bold px-3">
                      {m.home_score} - {m.away_score}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1 px-2">
                      <Input
                        type="number"
                        min="0"
                        className="w-12 text-center h-9"
                        value={scores[m.id]?.home ?? ""}
                        onChange={(e) => setScore(m.id, "home", e.target.value)}
                        placeholder="-"
                      />
                      <span className="text-muted-foreground">-</span>
                      <Input
                        type="number"
                        min="0"
                        className="w-12 text-center h-9"
                        value={scores[m.id]?.away ?? ""}
                        onChange={(e) => setScore(m.id, "away", e.target.value)}
                        placeholder="-"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSaveResult(m.id)}
                        disabled={loadingId === m.id}
                        className="ml-1"
                      >
                        {loadingId === m.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  )}

                  <span className="font-semibold flex-1 text-left">
                    {m.away_team?.name}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {m.match_date && (
                    <span>{formatDateShort(m.match_date)}</span>
                  )}
                  {m.venue && <span>— {m.venue}</span>}
                </div>

                {m.status !== "termine" && (
                  <div className="mt-2 flex gap-2 items-end">
                    <div className="flex-1">
                      <Input
                        type="datetime-local"
                        className="text-xs h-8"
                        value={editingDate[m.id] || ""}
                        onChange={(e) =>
                          setEditingDate((p) => ({
                            ...p,
                            [m.id]: e.target.value,
                          }))
                        }
                        placeholder="Date"
                      />
                    </div>
                    <div className="flex-1">
                      <Input
                        className="text-xs h-8"
                        value={editingVenue[m.id] || ""}
                        onChange={(e) =>
                          setEditingVenue((p) => ({
                            ...p,
                            [m.id]: e.target.value,
                          }))
                        }
                        placeholder="Lieu"
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => handleSaveDetails(m.id)}
                      disabled={loadingId === `d-${m.id}`}
                    >
                      {loadingId === `d-${m.id}` ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "OK"
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ))}
    </div>
  );
}

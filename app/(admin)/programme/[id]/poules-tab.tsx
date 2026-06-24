"use client";

import { useState } from "react";
import {
  createGroup,
  deleteGroup,
  addTeamToGroup,
  removeTeamFromGroup,
  generateGroupMatches,
} from "@/lib/actions/tournament-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  X,
  Loader2,
  CalendarPlus,
} from "lucide-react";
import { toast } from "sonner";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface PoulesTabProps {
  tournamentId: string;
  groups: any[];
  zoneTeams: { id: string; name: string }[];
}

export function PoulesTab({ tournamentId, groups, zoneTeams }: PoulesTabProps) {
  const [newGroupName, setNewGroupName] = useState("");
  const [addingGroup, setAddingGroup] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Record<string, string>>({});
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  async function handleAddGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setAddingGroup(true);
    const result = await createGroup(
      tournamentId,
      newGroupName,
      groups.length
    );
    if (result.error) toast.error(result.error);
    else {
      toast.success("Poule créée");
      setNewGroupName("");
    }
    setAddingGroup(false);
  }

  async function handleDeleteGroup(groupId: string) {
    if (!confirm("Supprimer cette poule et tous ses matchs ?")) return;
    setLoadingAction(groupId);
    const result = await deleteGroup(groupId, tournamentId);
    if (result.error) toast.error(result.error);
    else toast.success("Poule supprimée");
    setLoadingAction(null);
  }

  async function handleAddTeam(groupId: string) {
    const teamId = selectedTeam[groupId];
    if (!teamId) return;
    setLoadingAction(`add-${groupId}`);
    const result = await addTeamToGroup(groupId, teamId, tournamentId);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Équipe ajoutée");
      setSelectedTeam((prev) => ({ ...prev, [groupId]: "" }));
    }
    setLoadingAction(null);
  }

  async function handleRemoveTeam(id: string) {
    setLoadingAction(`rm-${id}`);
    const result = await removeTeamFromGroup(id, tournamentId);
    if (result.error) toast.error(result.error);
    else toast.success("Équipe retirée");
    setLoadingAction(null);
  }

  async function handleGenerateMatches(groupId: string, teamIds: string[]) {
    if (teamIds.length < 2) {
      toast.error("Il faut au moins 2 équipes");
      return;
    }
    if (!confirm("Générer le calendrier des matchs pour cette poule ?")) return;
    setLoadingAction(`gen-${groupId}`);
    const result = await generateGroupMatches(tournamentId, groupId, teamIds);
    if (result.error) toast.error(result.error);
    else toast.success(`${result.count} matchs générés`);
    setLoadingAction(null);
  }

  // Collect all team IDs already assigned to a group
  const assignedTeamIds = new Set(
    groups.flatMap((g: any) =>
      (g.group_teams || []).map((gt: any) => gt.team?.id).filter(Boolean)
    )
  );

  return (
    <div className="space-y-6">
      <form onSubmit={handleAddGroup} className="flex gap-2">
        <Input
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          placeholder="Nom de la poule (ex: Poule A)"
          className="max-w-xs"
        />
        <Button
          type="submit"
          disabled={addingGroup}
          className="bg-brand hover:bg-brand/90"
        >
          {addingGroup ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Plus className="h-4 w-4 mr-1" />
              Ajouter
            </>
          )}
        </Button>
      </form>

      {groups.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          Créez des poules pour organiser le tournoi
        </p>
      ) : (
        <div className="grid gap-6">
          {groups.map((group: any) => {
            const groupTeamIds = (group.group_teams || [])
              .map((gt: any) => gt.team?.id)
              .filter(Boolean);
            const availableTeams = zoneTeams.filter(
              (t) => !assignedTeamIds.has(t.id)
            );

            return (
              <Card key={group.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{group.name}</CardTitle>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleGenerateMatches(group.id, groupTeamIds)
                        }
                        disabled={loadingAction === `gen-${group.id}`}
                        className="text-brand"
                      >
                        {loadingAction === `gen-${group.id}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <CalendarPlus className="h-4 w-4 mr-1" />
                            Générer matchs
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteGroup(group.id)}
                        disabled={loadingAction === group.id}
                        className="text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {(group.group_teams || []).map((gt: any) =>
                      gt.team ? (
                        <Badge
                          key={gt.id}
                          variant="secondary"
                          className="text-sm py-1 px-3 gap-1"
                        >
                          {gt.team.name}
                          <button
                            onClick={() => handleRemoveTeam(gt.id)}
                            className="ml-1 hover:text-danger"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ) : null
                    )}
                    {(group.group_teams || []).length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        Aucune équipe
                      </p>
                    )}
                  </div>

                  {availableTeams.length > 0 && (
                    <div className="flex gap-2 pt-2">
                      <Select
                        value={selectedTeam[group.id] || ""}
                        onValueChange={(v) =>
                          setSelectedTeam((prev) => ({
                            ...prev,
                            [group.id]: v ?? "",
                          }))
                        }
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Ajouter une équipe..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableTeams.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddTeam(group.id)}
                        disabled={
                          !selectedTeam[group.id] ||
                          loadingAction === `add-${group.id}`
                        }
                      >
                        {loadingAction === `add-${group.id}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

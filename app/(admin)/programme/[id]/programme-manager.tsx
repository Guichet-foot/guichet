"use client";

import { useState } from "react";
import {
  createGroup,
  addTeamToGroup,
  removeTeamFromGroup,
  generateGroupMatches,
  deleteGroup,
  updateMatchResult,
} from "@/lib/actions/tournament-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus,
  X,
  Loader2,
  CalendarPlus,
  Settings,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface ProgrammeManagerProps {
  tournamentId: string;
  groups: any[];
  zoneTeams: { id: string; name: string }[];
  mode: "setup" | "bar";
}

export function ProgrammeManager({
  tournamentId,
  groups,
  zoneTeams,
  mode,
}: ProgrammeManagerProps) {
  const [manageOpen, setManageOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [addingGroup, setAddingGroup] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Record<string, string>>({});
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const assignedTeamIds = new Set(
    groups.flatMap((g: any) =>
      (g.group_teams || []).map((gt: any) => gt.team?.id).filter(Boolean)
    )
  );

  async function handleAddGroup() {
    if (!newGroupName.trim()) return;
    setAddingGroup(true);
    const result = await createGroup(tournamentId, newGroupName, groups.length);
    if (result.error) toast.error(result.error);
    else { toast.success("Poule créée"); setNewGroupName(""); }
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
    else { toast.success("Équipe ajoutée"); setSelectedTeam((p) => ({ ...p, [groupId]: "" })); }
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
    if (teamIds.length < 2) { toast.error("Il faut au moins 2 équipes"); return; }
    if (!confirm("Générer le calendrier des matchs pour cette poule ?")) return;
    setLoadingAction(`gen-${groupId}`);
    const result = await generateGroupMatches(tournamentId, groupId, teamIds);
    if (result.error) toast.error(result.error);
    else toast.success(`${result.count} matchs générés`);
    setLoadingAction(null);
  }

  const managerContent = (
    <div className="space-y-6">
      {/* Add group */}
      <div className="space-y-2">
        <Label className="font-semibold">Créer une poule</Label>
        <div className="flex gap-2">
          <Input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddGroup(); } }}
            placeholder="Ex: Poule A"
            className="flex-1"
          />
          <Button
            type="button"
            disabled={addingGroup || !newGroupName.trim()}
            onClick={() => handleAddGroup()}
            className="bg-brand hover:bg-brand/90"
          >
            {addingGroup ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" />Créer</>}
          </Button>
        </div>
      </div>

      {/* Manage groups */}
      {groups.map((group: any) => {
        const groupTeamIds = (group.group_teams || []).map((gt: any) => gt.team?.id).filter(Boolean);
        const availableTeams = zoneTeams.filter((t) => !assignedTeamIds.has(t.id));

        return (
          <Card key={group.id}>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">{group.name}</h3>
                <div className="flex gap-1">
                  <Button
                    type="button" variant="outline" size="sm"
                    onClick={() => handleGenerateMatches(group.id, groupTeamIds)}
                    disabled={loadingAction === `gen-${group.id}`}
                    className="text-brand text-xs"
                  >
                    {loadingAction === `gen-${group.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <><CalendarPlus className="h-3 w-3 mr-1" />Générer matchs</>}
                  </Button>
                  <Button
                    type="button" variant="ghost" size="sm"
                    onClick={() => handleDeleteGroup(group.id)}
                    disabled={loadingAction === group.id}
                    className="text-danger"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {(group.group_teams || []).map((gt: any) =>
                  gt.team ? (
                    <Badge key={gt.id} variant="secondary" className="text-xs py-1 px-2 gap-1">
                      {gt.team.name}
                      <button onClick={() => handleRemoveTeam(gt.id)} className="ml-1 hover:text-danger">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ) : null
                )}
              </div>

              {availableTeams.length > 0 && (
                <div className="flex gap-2">
                  <Select
                    value={selectedTeam[group.id] || ""}
                    onValueChange={(v) => setSelectedTeam((p) => ({ ...p, [group.id]: v ?? "" }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Ajouter une équipe..." /></SelectTrigger>
                    <SelectContent>
                      {availableTeams.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button" variant="outline" size="sm"
                    onClick={() => handleAddTeam(group.id)}
                    disabled={!selectedTeam[group.id] || loadingAction === `add-${group.id}`}
                  >
                    {loadingAction === `add-${group.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  if (mode === "setup") {
    return managerContent;
  }

  return (
    <Dialog open={manageOpen} onOpenChange={setManageOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Settings className="h-4 w-4 mr-2" />
        Gérer les poules
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gérer les poules et équipes</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto pr-1">
          {managerContent}
        </div>
      </DialogContent>
    </Dialog>
  );
}

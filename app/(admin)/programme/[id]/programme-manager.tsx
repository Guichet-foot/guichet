"use client";

import { useState } from "react";
import {
  createGroup,
  addTeamToGroup,
  removeTeamFromGroup,
  deleteGroup,
  createTournamentMatch,
  updateMatchResult,
  deleteTournamentMatch,
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
  Settings,
  Trash2,
  UserPlus,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface ProgrammeManagerProps {
  tournamentId: string;
  tournamentZoneId: string;
  groups: any[];
  zoneTeams: { id: string; name: string }[];
  mode: "setup" | "bar";
}

export function ProgrammeManager({
  tournamentId,
  tournamentZoneId,
  groups,
  zoneTeams,
  mode,
}: ProgrammeManagerProps) {
  const [manageOpen, setManageOpen] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [addingGroup, setAddingGroup] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Record<string, string>>({});
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Match creation form
  const [matchGroupId, setMatchGroupId] = useState("");
  const [matchHomeTeamId, setMatchHomeTeamId] = useState("");
  const [matchAwayTeamId, setMatchAwayTeamId] = useState("");
  const [matchJournee, setMatchJournee] = useState("1");
  const [matchDate, setMatchDate] = useState("");
  const [matchVenue, setMatchVenue] = useState("");
  const [creatingMatch, setCreatingMatch] = useState(false);

  const assignedTeamIds = new Set(
    groups.flatMap((g: any) =>
      (g.group_teams || []).map((gt: any) => gt.team?.id).filter(Boolean)
    )
  );

  // Get teams for selected group
  const selectedGroupTeams = matchGroupId
    ? (groups.find((g: any) => g.id === matchGroupId)?.group_teams || [])
        .map((gt: any) => gt.team)
        .filter(Boolean)
    : [];

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

  async function handleCreateMatch() {
    if (!matchGroupId || !matchHomeTeamId || !matchAwayTeamId || !matchDate) {
      toast.error("Remplissez tous les champs obligatoires");
      return;
    }
    if (matchHomeTeamId === matchAwayTeamId) {
      toast.error("Les deux équipes doivent être différentes");
      return;
    }
    setCreatingMatch(true);
    const result = await createTournamentMatch({
      tournamentId,
      groupId: matchGroupId,
      homeTeamId: matchHomeTeamId,
      awayTeamId: matchAwayTeamId,
      journee: parseInt(matchJournee) || 1,
      matchDate: new Date(matchDate).toISOString(),
      venue: matchVenue,
      zoneId: tournamentZoneId,
    });
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Match créé");
      setMatchHomeTeamId("");
      setMatchAwayTeamId("");
      setMatchVenue("");
      setMatchOpen(false);
    }
    setCreatingMatch(false);
  }

  // Poules management content
  const poulesContent = (
    <div className="space-y-6">
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
          <Button type="button" disabled={addingGroup || !newGroupName.trim()} onClick={() => handleAddGroup()} className="bg-brand hover:bg-brand/90">
            {addingGroup ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" />Créer</>}
          </Button>
        </div>
      </div>

      {groups.map((group: any) => {
        const availableTeams = zoneTeams.filter((t) => !assignedTeamIds.has(t.id));
        return (
          <Card key={group.id}>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">{group.name}</h3>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleDeleteGroup(group.id)} disabled={loadingAction === group.id} className="text-danger">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {(group.group_teams || []).map((gt: any) =>
                  gt.team ? (
                    <Badge key={gt.id} variant="secondary" className="text-xs py-1 px-2 gap-1">
                      {gt.team.name}
                      <button onClick={() => handleRemoveTeam(gt.id)} className="ml-1 hover:text-danger"><X className="h-3 w-3" /></button>
                    </Badge>
                  ) : null
                )}
              </div>
              {availableTeams.length > 0 && (
                <div className="flex gap-2">
                  <Select value={selectedTeam[group.id] || ""} onValueChange={(v) => setSelectedTeam((p) => ({ ...p, [group.id]: v ?? "" }))}>
                    <SelectTrigger><SelectValue placeholder="Ajouter une équipe..." /></SelectTrigger>
                    <SelectContent>
                      {availableTeams.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="sm" onClick={() => handleAddTeam(group.id)} disabled={!selectedTeam[group.id] || loadingAction === `add-${group.id}`}>
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
    return poulesContent;
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {/* Create match button */}
      <Dialog open={matchOpen} onOpenChange={setMatchOpen}>
        <DialogTrigger render={<Button className="bg-brand hover:bg-brand/90" />}>
          <Plus className="h-4 w-4 mr-2" />
          Créer un match
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau match du programme</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Poule</Label>
              <Select value={matchGroupId} onValueChange={(v) => { setMatchGroupId(v ?? ""); setMatchHomeTeamId(""); setMatchAwayTeamId(""); }}>
                <SelectTrigger><SelectValue placeholder="Sélectionner la poule" /></SelectTrigger>
                <SelectContent>
                  {groups.map((g: any) => (<SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            {matchGroupId && selectedGroupTeams.length > 0 && (
              <>
                <div className="space-y-2">
                  <Label>Équipe domicile</Label>
                  <Select value={matchHomeTeamId} onValueChange={(v) => setMatchHomeTeamId(v ?? "")}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      {selectedGroupTeams.map((t: any) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Équipe visiteur</Label>
                  <Select value={matchAwayTeamId} onValueChange={(v) => setMatchAwayTeamId(v ?? "")}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      {selectedGroupTeams.filter((t: any) => t.id !== matchHomeTeamId).map((t: any) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Journée</Label>
                    <Input type="number" min="1" value={matchJournee} onChange={(e) => setMatchJournee(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Date et heure</Label>
                    <Input type="datetime-local" value={matchDate} onChange={(e) => setMatchDate(e.target.value)} required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Lieu (stade)</Label>
                  <Input value={matchVenue} onChange={(e) => setMatchVenue(e.target.value)} placeholder="Stade Municipal" />
                </div>
              </>
            )}

            {matchGroupId && selectedGroupTeams.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucune équipe dans cette poule. Ajoutez d&apos;abord des équipes.
              </p>
            )}

            <Button
              type="button"
              onClick={handleCreateMatch}
              disabled={creatingMatch || !matchGroupId || !matchHomeTeamId || !matchAwayTeamId || !matchDate}
              className="w-full bg-brand hover:bg-brand/90"
            >
              {creatingMatch ? <Loader2 className="h-4 w-4 animate-spin" /> : "Créer le match"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage poules button */}
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
            {poulesContent}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

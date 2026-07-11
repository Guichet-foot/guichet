"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTeam, updateTeam, deleteTeam } from "@/lib/actions/team-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Team {
  id: string;
  name: string;
  colors: string | null;
  president: string | null;
  delegates: string[] | null;
}

interface Zone {
  id: string;
  name: string;
  president: string | null;
  logo: string | null;
  teams: Team[];
}

function TeamColorSwatches({ colors }: { colors: string }) {
  try {
    const parsed = JSON.parse(colors);
    const off = parsed.official || [];
    const sub = parsed.substitute || [];
    return (
      <span className="inline-flex items-center gap-1.5">
        {off.length === 2 && (
          <span
            className="inline-block w-5 h-5 rounded border border-border shrink-0"
            style={{ background: `linear-gradient(135deg, ${off[0]} 50%, ${off[1]} 50%)` }}
            title="Officielle"
          />
        )}
        {sub.length === 2 && (
          <span
            className="inline-block w-5 h-5 rounded border border-border shrink-0"
            style={{ background: `linear-gradient(135deg, ${sub[0]} 50%, ${sub[1]} 50%)` }}
            title="Substitution"
          />
        )}
      </span>
    );
  } catch {
    return null;
  }
}

function parseColors(colors: string | null) {
  try {
    const parsed = JSON.parse(colors || "{}");
    return {
      off1: parsed.official?.[0] || "#000000",
      off2: parsed.official?.[1] || "#ffffff",
      sub1: parsed.substitute?.[0] || "#000000",
      sub2: parsed.substitute?.[1] || "#ffffff",
    };
  } catch {
    return { off1: "#000000", off2: "#ffffff", sub1: "#000000", sub2: "#ffffff" };
  }
}

function buildColors(off1: string, off2: string, sub1: string, sub2: string) {
  return JSON.stringify({ official: [off1, off2], substitute: [sub1, sub2] });
}

function ColorPairPicker({
  label,
  color1,
  color2,
  onChange1,
  onChange2,
}: {
  label: string;
  color1: string;
  color2: string;
  onChange1: (v: string) => void;
  onChange2: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={color1}
            onChange={(e) => onChange1(e.target.value)}
            className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent p-0.5"
            title="Couleur principale"
          />
          <input
            type="color"
            value={color2}
            onChange={(e) => onChange2(e.target.value)}
            className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent p-0.5"
            title="Couleur secondaire"
          />
        </div>
        <span
          className="inline-block h-8 w-8 rounded border border-border shrink-0"
          style={{ background: `linear-gradient(135deg, ${color1} 50%, ${color2} 50%)` }}
        />
      </div>
    </div>
  );
}

export function EquipesManager({ zones }: { zones: Zone[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createZoneId, setCreateZoneId] = useState("");
  const [createName, setCreateName] = useState("");
  const [createOff1, setCreateOff1] = useState("#000000");
  const [createOff2, setCreateOff2] = useState("#ffffff");
  const [createSub1, setCreateSub1] = useState("#000000");
  const [createSub2, setCreateSub2] = useState("#ffffff");

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editTeamId, setEditTeamId] = useState("");
  const [editName, setEditName] = useState("");
  const [editTeamData, setEditTeamData] = useState<Team | null>(null);
  const [editOff1, setEditOff1] = useState("#000000");
  const [editOff2, setEditOff2] = useState("#ffffff");
  const [editSub1, setEditSub1] = useState("#000000");
  const [editSub2, setEditSub2] = useState("#ffffff");

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTeamId, setDeleteTeamId] = useState("");
  const [deleteTeamName, setDeleteTeamName] = useState("");

  function openEdit(team: Team) {
    setEditTeamId(team.id);
    setEditName(team.name);
    setEditTeamData(team);
    const c = parseColors(team.colors);
    setEditOff1(c.off1);
    setEditOff2(c.off2);
    setEditSub1(c.sub1);
    setEditSub2(c.sub2);
    setEditOpen(true);
  }

  function openDelete(team: Team) {
    setDeleteTeamId(team.id);
    setDeleteTeamName(team.name);
    setDeleteOpen(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createZoneId) { toast.error("Sélectionnez une zone"); return; }
    if (!createName.trim()) { toast.error("Entrez un nom d'équipe"); return; }
    setLoading(true);
    const result = await createTeam({
      zoneId: createZoneId,
      name: createName.trim(),
      president: "",
      delegates: [],
      colors: buildColors(createOff1, createOff2, createSub1, createSub2),
    });
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Équipe ajoutée");
    setCreateOpen(false);
    setCreateName("");
    setCreateZoneId("");
    setCreateOff1("#000000"); setCreateOff2("#ffffff");
    setCreateSub1("#000000"); setCreateSub2("#ffffff");
    router.refresh();
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editName.trim()) { toast.error("Entrez un nom d'équipe"); return; }
    setLoading(true);
    const result = await updateTeam(editTeamId, {
      name: editName.trim(),
      president: editTeamData?.president || "",
      delegates: editTeamData?.delegates || [],
      colors: buildColors(editOff1, editOff2, editSub1, editSub2),
    });
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Équipe modifiée");
    setEditOpen(false);
    router.refresh();
  }

  async function handleDelete() {
    setLoading(true);
    const result = await deleteTeam(deleteTeamId);
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Équipe supprimée");
    setDeleteOpen(false);
    router.refresh();
  }

  const totalTeams = zones.reduce((s, z) => s + z.teams.length, 0);

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {zones.length} zone{zones.length !== 1 ? "s" : ""} · {totalTeams} équipe{totalTeams !== 1 ? "s" : ""}
        </p>
        <Button className="bg-brand hover:bg-brand/90" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter une équipe
        </Button>
      </div>

      {/* Zone cards */}
      {zones.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <MapPin className="h-16 w-16 mb-4 opacity-30" />
          <p className="text-lg">Aucune zone</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {zones.map((zone) => (
            <Card key={zone.id} className="overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 border-b border-indigo-100">
                {zone.logo ? (
                  <img src={zone.logo} alt={zone.name} className="w-8 h-8 rounded object-cover border" />
                ) : (
                  <div className="w-8 h-8 rounded bg-indigo-200 flex items-center justify-center shrink-0">
                    <MapPin className="h-4 w-4 text-indigo-700" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-indigo-900 truncate block">{zone.name}</span>
                </div>
                {zone.president && (
                  <span className="text-xs text-indigo-600 shrink-0 hidden sm:block truncate max-w-[120px]">
                    {zone.president}
                  </span>
                )}
              </div>

              <CardContent className="p-0">
                {zone.teams.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucune équipe</p>
                ) : (
                  <div className="divide-y divide-border">
                    {zone.teams.map((team) => (
                      <div key={team.id} className="flex items-center justify-between px-4 py-2.5 gap-2">
                        <span className="text-sm font-medium truncate flex-1">{team.name}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {team.colors && <TeamColorSwatches colors={team.colors} />}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => openEdit(team)}
                            title="Modifier"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => openDelete(team)}
                            title="Supprimer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajouter une équipe</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label>Zone</Label>
              <Select value={createZoneId} onValueChange={(v) => setCreateZoneId(v ?? "")} required>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une zone" />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((z) => (
                    <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-team-name">Nom de l'équipe</Label>
              <Input
                id="create-team-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="ASC Ndiarème"
                required
                autoFocus
              />
            </div>
            <div className="space-y-3">
              <Label>Couleurs</Label>
              <ColorPairPicker
                label="Tenue officielle"
                color1={createOff1} color2={createOff2}
                onChange1={setCreateOff1} onChange2={setCreateOff2}
              />
              <ColorPairPicker
                label="Tenue de substitution"
                color1={createSub1} color2={createSub2}
                onChange1={setCreateSub1} onChange2={setCreateSub2}
              />
            </div>
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setCreateOpen(false)} disabled={loading}>
                Annuler
              </Button>
              <Button type="submit" className="flex-1 bg-brand hover:bg-brand/90" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ajouter"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Modifier l'équipe</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label htmlFor="edit-team-name">Nom de l'équipe</Label>
              <Input
                id="edit-team-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-3">
              <Label>Couleurs</Label>
              <ColorPairPicker
                label="Tenue officielle"
                color1={editOff1} color2={editOff2}
                onChange1={setEditOff1} onChange2={setEditOff2}
              />
              <ColorPairPicker
                label="Tenue de substitution"
                color1={editSub1} color2={editSub2}
                onChange1={setEditSub1} onChange2={setEditSub2}
              />
            </div>
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setEditOpen(false)} disabled={loading}>
                Annuler
              </Button>
              <Button type="submit" className="flex-1 bg-brand hover:bg-brand/90" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Supprimer l'équipe ?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Supprimer <strong>{deleteTeamName}</strong> ? Cette action est irréversible.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteOpen(false)} disabled={loading}>
                Annuler
              </Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Supprimer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useState, useEffect } from "react";
import { createTeam, updateTeam } from "@/lib/actions/team-actions";
import { getAdminZonesForForm } from "@/lib/actions/match-actions";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, X, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import type { UserRole } from "@/lib/types";

interface TeamColors {
  official: [string, string];
  substitute: [string, string];
}

function parseColors(raw: string | null): TeamColors {
  if (!raw) return { official: ["#FFFFFF", "#000000"], substitute: ["#000000", "#FFFFFF"] };
  try {
    const parsed = JSON.parse(raw);
    return {
      official: parsed.official || ["#FFFFFF", "#000000"],
      substitute: parsed.substitute || ["#000000", "#FFFFFF"],
    };
  } catch {
    return { official: ["#FFFFFF", "#000000"], substitute: ["#000000", "#FFFFFF"] };
  }
}

function ColorPairPicker({
  label,
  color1,
  color2,
  onChange,
}: {
  label: string;
  color1: string;
  color2: string;
  onChange: (c1: string, c2: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <div
            className="w-8 h-8 rounded-lg border border-border shrink-0 cursor-pointer relative overflow-hidden"
            style={{ backgroundColor: color1 }}
          >
            <input
              type="color"
              value={color1}
              onChange={(e) => onChange(e.target.value, color2)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </div>
          <span className="text-xs text-muted-foreground">Couleur 1</span>
        </div>
        <div className="flex items-center gap-2 flex-1">
          <div
            className="w-8 h-8 rounded-lg border border-border shrink-0 cursor-pointer relative overflow-hidden"
            style={{ backgroundColor: color2 }}
          >
            <input
              type="color"
              value={color2}
              onChange={(e) => onChange(color1, e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </div>
          <span className="text-xs text-muted-foreground">Couleur 2</span>
        </div>
        <div
          className="w-12 h-8 rounded-lg border border-border shrink-0"
          style={{
            background: `linear-gradient(135deg, ${color1} 50%, ${color2} 50%)`,
          }}
          title="Aperçu"
        />
      </div>
    </div>
  );
}

interface TeamFormDialogProps {
  zoneId: string | null;
  userRole: UserRole;
  editTeam?: {
    id: string;
    name: string;
    president: string | null;
    delegates: string[];
    colors: string | null;
    zone_id: string;
  };
  trigger?: React.ReactNode;
}

export function TeamFormDialog({
  zoneId,
  userRole,
  editTeam,
  trigger,
}: TeamFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [zones, setZones] = useState<{ id: string; name: string }[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState(
    editTeam?.zone_id || zoneId || ""
  );

  const [name, setName] = useState(editTeam?.name || "");
  const [president, setPresident] = useState(editTeam?.president || "");
  const [delegates, setDelegates] = useState<string[]>(
    editTeam?.delegates?.length ? editTeam.delegates : [""]
  );

  const initialColors = parseColors(editTeam?.colors || null);
  const [officialColors, setOfficialColors] = useState<[string, string]>(initialColors.official);
  const [substituteColors, setSubstituteColors] = useState<[string, string]>(initialColors.substitute);

  const isOdcavRole = userRole === "super_admin" || userRole === "president_odcav" || userRole === "tresorier" || userRole === "fondateur";

  useEffect(() => {
    if (isOdcavRole) {
      getAdminZonesForForm().then((data) => setZones(data));
    }
  }, [isOdcavRole]);

  function addDelegate() {
    setDelegates([...delegates, ""]);
  }

  function removeDelegate(index: number) {
    setDelegates(delegates.filter((_, i) => i !== index));
  }

  function updateDelegate(index: number, value: string) {
    const updated = [...delegates];
    updated[index] = value;
    setDelegates(updated);
  }

  function resetForm() {
    if (!editTeam) {
      setName("");
      setPresident("");
      setDelegates([""]);
      setOfficialColors(["#FFFFFF", "#000000"]);
      setSubstituteColors(["#000000", "#FFFFFF"]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const finalZoneId = isOdcavRole ? (selectedZoneId || zoneId) : zoneId;
    if (!finalZoneId) {
      toast.error("Zone non sélectionnée");
      setLoading(false);
      return;
    }

    const colorsJson = JSON.stringify({
      official: officialColors,
      substitute: substituteColors,
    });

    if (editTeam) {
      const result = await updateTeam(editTeam.id, {
        name,
        president,
        delegates,
        colors: colorsJson,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Équipe modifiée");
        setOpen(false);
      }
    } else {
      const result = await createTeam({
        zoneId: finalZoneId,
        name,
        president,
        delegates,
        colors: colorsJson,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Équipe ajoutée");
        resetForm();
        setOpen(false);
      }
    }
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger render={<span />}>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger
          render={<Button className="bg-brand hover:bg-brand/90" />}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle équipe
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editTeam ? "Modifier l'équipe" : "Nouvelle équipe"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isOdcavRole && !zoneId && (
            <div className="space-y-2">
              <Label>Zone</Label>
              <Select
                value={selectedZoneId}
                onValueChange={(v) => setSelectedZoneId(v ?? "")}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder={zones.length === 0 ? "Chargement…" : "Choisir une zone"} />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {isOdcavRole && zoneId && zones.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Zone : <strong>{zones.find((z) => z.id === zoneId)?.name ?? zoneId}</strong>
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="teamName">Nom de l&apos;ASC</Label>
            <Input
              id="teamName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="ASC Ndiarème"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="president">Président</Label>
            <Input
              id="president"
              value={president}
              onChange={(e) => setPresident(e.target.value)}
              placeholder="Nom du président"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Délégué(s)</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addDelegate}
                className="text-brand"
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Ajouter
              </Button>
            </div>
            <div className="space-y-2">
              {delegates.map((d, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={d}
                    onChange={(e) => updateDelegate(i, e.target.value)}
                    placeholder={`Délégué ${i + 1}`}
                  />
                  {delegates.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDelegate(i)}
                      className="text-danger shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label>Couleurs de l&apos;ASC</Label>
            <ColorPairPicker
              label="Tenue officielle"
              color1={officialColors[0]}
              color2={officialColors[1]}
              onChange={(c1, c2) => setOfficialColors([c1, c2])}
            />
            <ColorPairPicker
              label="Tenue de substitution"
              color1={substituteColors[0]}
              color2={substituteColors[1]}
              onChange={(c1, c2) => setSubstituteColors([c1, c2])}
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-brand hover:bg-brand/90"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : editTeam ? (
              "Modifier"
            ) : (
              "Enregistrer"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

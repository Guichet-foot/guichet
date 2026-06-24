"use client";

import { useState, useEffect } from "react";
import { createTeam, updateTeam } from "@/lib/actions/team-actions";
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
  const [colors, setColors] = useState(editTeam?.colors || "");

  useEffect(() => {
    if (userRole === "super_admin") {
      async function fetchZones() {
        const supabase = createClient();
        const { data } = await supabase
          .from("zones")
          .select("id, name")
          .order("name");
        if (data) setZones(data);
      }
      fetchZones();
    }
  }, [userRole]);

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
      setColors("");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const finalZoneId = userRole === "super_admin" ? selectedZoneId : zoneId;
    if (!finalZoneId) {
      toast.error("Zone non sélectionnée");
      setLoading(false);
      return;
    }

    if (editTeam) {
      const result = await updateTeam(editTeam.id, {
        name,
        president,
        delegates,
        colors,
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
        colors,
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
          {userRole === "super_admin" && (
            <div className="space-y-2">
              <Label>Zone</Label>
              <Select
                value={selectedZoneId}
                onValueChange={(v) => setSelectedZoneId(v ?? "")}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une zone" />
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

          <div className="space-y-2">
            <Label htmlFor="colors">Couleurs de l&apos;ASC</Label>
            <Input
              id="colors"
              value={colors}
              onChange={(e) => setColors(e.target.value)}
              placeholder="Rouge et Blanc"
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

"use client";

import { useState, useEffect } from "react";
import { createTournament } from "@/lib/actions/tournament-actions";
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
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { UserRole } from "@/lib/types";

interface Props {
  zoneId: string | null;
  userRole: UserRole;
}

export function CreateTournamentDialog({ zoneId, userRole }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [zones, setZones] = useState<{ id: string; name: string }[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState(zoneId || "");
  const [name, setName] = useState("");
  const [season, setSeason] = useState(
    `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
  );

  useEffect(() => {
    if (userRole === "super_admin") {
      async function fetchZones() {
        const supabase = createClient();
        const { data } = await supabase.from("zones").select("id, name").order("name");
        if (data) setZones(data);
      }
      fetchZones();
    }
  }, [userRole]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const finalZone = userRole === "super_admin" ? selectedZoneId : zoneId;
    if (!finalZone) {
      toast.error("Sélectionnez une zone");
      return;
    }
    setLoading(true);
    const result = await createTournament({ zoneId: finalZone, name, season });
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Tournoi créé");
      setName("");
      setOpen(false);
    }
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="bg-brand hover:bg-brand/90" />}>
        <Plus className="h-4 w-4 mr-2" />
        Nouveau tournoi
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau tournoi</DialogTitle>
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
            <Label>Nom du tournoi</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Navétane Zone Mbour"
            />
          </div>
          <div className="space-y-2">
            <Label>Saison</Label>
            <Input
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              required
              placeholder="2025-2026"
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-brand hover:bg-brand/90"
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Créer"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

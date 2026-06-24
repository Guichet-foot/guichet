"use client";

import { useState } from "react";
import { createTournament } from "@/lib/actions/tournament-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function CreateTournamentDialog({ zoneId }: { zoneId: string | null }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [season, setSeason] = useState(
    `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!zoneId) {
      toast.error("Zone introuvable");
      return;
    }
    setLoading(true);
    const result = await createTournament({ zoneId, name, season });
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

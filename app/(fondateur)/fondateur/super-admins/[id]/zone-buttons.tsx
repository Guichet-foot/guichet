"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createZoneForOdcav, updateZoneBasic } from "@/lib/actions/fondateur-zone-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";

// ── Create zone ──────────────────────────────────────────────────────

export function CreateZoneButton({ odcavId }: { odcavId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error("Entrez un nom de zone"); return; }
    setLoading(true);
    const result = await createZoneForOdcav(odcavId, name, region);
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Zone créée");
    setOpen(false);
    setName("");
    setRegion("");
    router.refresh();
  }

  return (
    <>
      <Button size="sm" className="bg-brand hover:bg-brand/90" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1" />
        Créer une zone
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Créer une zone</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label htmlFor="zone-name">Nom de la zone</Label>
              <Input
                id="zone-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Zone 1 — Dakar"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zone-region">Région (optionnel)</Label>
              <Input
                id="zone-region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="Dakar"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)} disabled={loading}>
                Annuler
              </Button>
              <Button type="submit" className="flex-1 bg-brand hover:bg-brand/90" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Créer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Edit zone ────────────────────────────────────────────────────────

interface EditZoneButtonProps {
  zoneId: string;
  odcavId: string;
  initialName: string;
  initialRegion: string;
}

export function EditZoneButton({ zoneId, odcavId, initialName, initialRegion }: EditZoneButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [region, setRegion] = useState(initialRegion);
  const [loading, setLoading] = useState(false);

  function handleOpen() {
    setName(initialName);
    setRegion(initialRegion);
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error("Entrez un nom de zone"); return; }
    setLoading(true);
    const result = await updateZoneBasic(zoneId, odcavId, name, region);
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Zone modifiée");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleOpen}
        className="text-muted-foreground hover:text-foreground shrink-0"
        title="Modifier la zone"
      >
        <Pencil className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Modifier la zone</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label htmlFor="edit-zone-name">Nom de la zone</Label>
              <Input
                id="edit-zone-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-zone-region">Région (optionnel)</Label>
              <Input
                id="edit-zone-region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              />
            </div>
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)} disabled={loading}>
                Annuler
              </Button>
              <Button type="submit" className="flex-1 bg-brand hover:bg-brand/90" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

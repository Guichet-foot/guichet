"use client";

import { useState } from "react";
import { createZone } from "@/lib/actions/zone-actions";
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

export function CreateZoneForm() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const result = await createZone({ name, region });

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Zone créée");
      setName("");
      setRegion("");
      setOpen(false);
    }
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button className="bg-brand hover:bg-brand/90" />}
      >
        <Plus className="h-4 w-4 mr-2" />
        Nouvelle zone
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle zone</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="zoneName">Nom de la zone</Label>
            <Input
              id="zoneName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Zone Mbour"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="zoneRegion">Région</Label>
            <Input
              id="zoneRegion"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="Thiès"
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

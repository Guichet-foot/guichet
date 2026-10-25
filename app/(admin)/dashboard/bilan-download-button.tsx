"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
  tab: "zone" | "c3" | "odcav";
  zones?: { id: string; name: string }[];
  c3Accounts?: { id: string; name: string; city?: string | null }[];
}

export function BilanDownloadButton({ tab, zones = [], c3Accounts = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState(() => format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd"));
  const [to, setTo] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [zoneId, setZoneId] = useState("");
  const [c3Id, setC3Id] = useState("");

  async function handleDownload() {
    setLoading(true);
    try {
      const res = await fetch("/api/reports/fondateur", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: from || undefined,
          to: to || undefined,
          type: tab,
          zoneId: tab === "zone" ? (zoneId || undefined) : undefined,
          c3Id: tab === "c3" ? (c3Id || undefined) : undefined,
        }),
      });
      if (!res.ok) {
        toast.error("Erreur lors de la génération du bilan");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bilan-${tab}${from ? `-${from}` : ""}${to ? `-au-${to}` : ""}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Bilan téléchargé");
      setOpen(false);
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="shrink-0">
        <FileDown className="h-4 w-4 mr-2" />
        Télécharger Bilan
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Télécharger le bilan</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Du</Label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Au</Label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>

            {tab === "zone" && zones.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Zone</Label>
                <Select value={zoneId || "__all__"} onValueChange={(v) => setZoneId(!v || v === "__all__" ? "" : v)}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Toutes les zones" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Toutes les zones</SelectItem>
                    {zones.map((z) => (
                      <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {tab === "c3" && c3Accounts.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">C3</Label>
                <Select value={c3Id || "__all__"} onValueChange={(v) => setC3Id(!v || v === "__all__" ? "" : v)}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Tous les C3" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tous les C3</SelectItem>
                    {c3Accounts.map((c3) => (
                      <SelectItem key={c3.id} value={c3.id}>
                        {c3.name}{c3.city ? ` — ${c3.city}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
              Annuler
            </Button>
            <Button onClick={handleDownload} disabled={loading} className="bg-brand hover:bg-brand/90">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
              Télécharger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

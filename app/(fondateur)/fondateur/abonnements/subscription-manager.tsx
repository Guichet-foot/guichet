"use client";

import { useState } from "react";
import { updateSubscription, toggleSubscriptionActive } from "@/lib/actions/subscription-actions";
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
} from "@/components/ui/dialog";
import { Loader2, Settings, Ban, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface SubscriptionManagerProps {
  zoneId: string;
  zoneName: string;
  currentType: string;
  currentStart: string;
  currentEnd: string;
  currentActive: boolean;
}

export function SubscriptionManager({
  zoneId,
  zoneName,
  currentType,
  currentStart,
  currentEnd,
  currentActive,
}: SubscriptionManagerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const [type, setType] = useState(currentType || "mensuel");
  const [startDate, setStartDate] = useState(currentStart || new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(currentEnd || "");

  function autoEndDate(t: string, start: string) {
    if (!start) return "";
    const d = new Date(start);
    if (t === "mensuel") d.setMonth(d.getMonth() + 1);
    else if (t === "15_jours") d.setDate(d.getDate() + 15);
    else if (t === "annuel") d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split("T")[0];
  }

  async function handleSave() {
    setLoading("save");
    const result = await updateSubscription(zoneId, {
      type,
      startDate,
      endDate: endDate || autoEndDate(type, startDate),
      active: true,
    }) as any;
    if (result.error) toast.error(result.error);
    else { toast.success("Abonnement mis à jour"); setOpen(false); }
    setLoading(null);
  }

  async function handleToggle() {
    setLoading("toggle");
    const result = await toggleSubscriptionActive(zoneId, !currentActive) as any;
    if (result.error) toast.error(result.error);
    else toast.success(currentActive ? "Zone bloquée" : "Zone débloquée");
    setLoading(null);
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)} className="h-7 w-7 p-0" title="Gérer">
        <Settings className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={handleToggle} disabled={loading === "toggle"}
        className={`h-7 w-7 p-0 ${currentActive ? "text-orange-500" : "text-green-600"}`}
        title={currentActive ? "Bloquer" : "Débloquer"}>
        {loading === "toggle" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : currentActive ? <Ban className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abonnement — {zoneName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type d&apos;abonnement</Label>
              <Select value={type} onValueChange={(v) => {
                const newType = v ?? "mensuel";
                setType(newType);
                setEndDate(autoEndDate(newType, startDate));
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensuel">Mensuel</SelectItem>
                  <SelectItem value="15_jours">15 jours</SelectItem>
                  <SelectItem value="annuel">Annuel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date début</Label>
                <Input type="date" value={startDate} onChange={(e) => {
                  setStartDate(e.target.value);
                  setEndDate(autoEndDate(type, e.target.value));
                }} />
              </div>
              <div className="space-y-2">
                <Label>Date fin</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <Button type="button" onClick={handleSave} disabled={loading === "save"} className="w-full bg-amber-600 hover:bg-amber-700">
              {loading === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer l'abonnement"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

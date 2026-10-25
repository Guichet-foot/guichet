"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, CalendarDays, RotateCcw, Building2 } from "lucide-react";
import { useState, useEffect } from "react";

interface Zone { id: string; name: string; }
interface C3Account { id: string; name: string; city?: string | null; }

const PERIOD_OPTIONS = [
  { value: "today", label: "Aujourd'hui" },
  { value: "yesterday", label: "Hier" },
  { value: "7d", label: "7 derniers jours" },
  { value: "custom", label: "Période personnalisée" },
];

export function OdcavDashboardFilters({
  tab,
  zones = [],
  currentZone = "",
  c3Accounts = [],
  currentC3 = "",
}: {
  tab: "zone" | "c3" | "odcav";
  zones?: Zone[];
  currentZone?: string;
  c3Accounts?: C3Account[];
  currentC3?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentPeriod = searchParams.get("period") || "today";
  const currentStart = searchParams.get("start") || "";
  const currentEnd = searchParams.get("end") || "";

  const [period, setPeriod] = useState(currentPeriod);
  const [start, setStart] = useState(currentStart);
  const [end, setEnd] = useState(currentEnd);
  const [zone, setZone] = useState(currentZone);
  const [c3, setC3] = useState(currentC3);

  useEffect(() => { setPeriod(currentPeriod); }, [currentPeriod]);
  useEffect(() => { setStart(currentStart); }, [currentStart]);
  useEffect(() => { setEnd(currentEnd); }, [currentEnd]);
  useEffect(() => { setZone(currentZone); }, [currentZone]);
  useEffect(() => { setC3(currentC3); }, [currentC3]);

  const isCustom = period === "custom";

  function push(overrides: Record<string, string> = {}) {
    const p = new URLSearchParams();
    p.set("tab", tab);
    const per = overrides.period ?? period;
    if (per !== "today") p.set("period", per);
    if (per === "custom") {
      const s = overrides.start ?? start;
      const e = overrides.end ?? end;
      if (s) p.set("start", s);
      if (e) p.set("end", e);
    }
    if (tab === "zone") {
      const z = overrides.zone ?? zone;
      if (z) p.set("zone", z);
    }
    if (tab === "c3") {
      const c = overrides.c3 ?? c3;
      if (c) p.set("c3", c);
    }
    router.push(`${pathname}?${p.toString()}`);
  }

  function handlePeriodChange(v: string | null) {
    const val = v || "today";
    setPeriod(val);
    if (val !== "custom") push({ period: val });
  }

  function handleZoneChange(v: string | null) {
    const z = !v || v === "__all__" ? "" : v;
    setZone(z);
    push({ zone: z });
  }

  function handleC3Change(v: string | null) {
    const c = !v || v === "__all__" ? "" : v;
    setC3(c);
    push({ c3: c });
  }

  function applyCustom() {
    push({ period: "custom", start, end });
  }

  function reset() {
    setPeriod("today");
    setZone("");
    setC3("");
    setStart("");
    setEnd("");
    router.push(`${pathname}?tab=${tab}`);
  }

  const hasFilters = !!(zone || c3 || period !== "today" || (isCustom && (start || end)));

  return (
    <div className="flex flex-wrap items-end gap-3">
      {tab === "zone" && zones.length > 0 && (
        <div className="space-y-1.5 w-full sm:w-auto">
          <Label className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
            <MapPin className="h-3 w-3" /> Filtrer par zone
          </Label>
          <Select value={zone || "__all__"} onValueChange={handleZoneChange}>
            <SelectTrigger className="h-9 w-full sm:w-44 text-sm">
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
        <div className="space-y-1.5 w-full sm:w-auto">
          <Label className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
            <Building2 className="h-3 w-3" /> Filtrer par C3
          </Label>
          <Select value={c3 || "__all__"} onValueChange={handleC3Change}>
            <SelectTrigger className="h-9 w-full sm:w-52 text-sm">
              <SelectValue placeholder="Tous les C3" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tous les C3</SelectItem>
              {c3Accounts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}{c.city ? ` — ${c.city}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5 w-full sm:w-auto">
        <Label className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
          <CalendarDays className="h-3 w-3" /> Filtrer par période
        </Label>
        <Select value={period} onValueChange={handlePeriodChange}>
          <SelectTrigger className="h-9 w-full sm:w-48 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isCustom && (
        <div className="flex flex-wrap items-end gap-2 w-full sm:w-auto">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Début</Label>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-9 w-36 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Fin</Label>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9 w-36 text-sm" />
          </div>
          <Button size="sm" onClick={applyCustom} className="h-9 bg-brand hover:bg-brand/90" disabled={!start || !end}>
            Appliquer
          </Button>
        </div>
      )}

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={reset} className="h-9 text-muted-foreground hover:text-danger">
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Réinitialiser
        </Button>
      )}
    </div>
  );
}

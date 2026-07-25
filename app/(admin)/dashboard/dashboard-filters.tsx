"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, CalendarDays, RotateCcw, Filter, X, Building2 } from "lucide-react";
import { useState } from "react";

interface Zone { id: string; name: string; }

interface DashboardFiltersProps {
  /** Zone list (ODCAV global view only) */
  zones?: Zone[];
  /** Pre-selected zone from URL */
  currentZone?: string;
  /** Legacy match filter (zone-specific view) */
  matches?: { id: string; label: string }[];
  /** Whether to show the zone dropdown */
  showZoneFilter?: boolean;
  /** C3 accounts list for C3 filter dropdown */
  c3Accounts?: { id: string; name: string; city?: string | null }[];
  /** Currently selected C3 account ID */
  currentC3?: string;
}

const PERIOD_OPTIONS = [
  { value: "30d",       label: "30 derniers jours" },
  { value: "7d",        label: "7 derniers jours" },
  { value: "today",     label: "Aujourd'hui" },
  { value: "month",     label: "Ce mois" },
  { value: "prevmonth", label: "Mois précédent" },
  { value: "custom",    label: "Période personnalisée" },
];

export function DashboardFilters({
  zones = [],
  currentZone = "",
  matches = [],
  showZoneFilter = false,
  c3Accounts = [],
  currentC3 = "",
}: DashboardFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentPeriod  = searchParams.get("period") || "today";
  const currentStart   = searchParams.get("start") || "";
  const currentEnd     = searchParams.get("end") || "";
  const currentMatch   = searchParams.get("match") || "";
  const legacyDate     = searchParams.get("date") || "";
  const legacyYear     = searchParams.get("year") || "";

  const [period, setPeriod]   = useState(currentPeriod);
  const [start, setStart]     = useState(currentStart);
  const [end, setEnd]         = useState(currentEnd);
  const [zone, setZone]       = useState(currentZone);
  const [c3Account, setC3Account] = useState(currentC3);
  const [matchId, setMatchId] = useState(currentMatch);
  const [showLegacy, setShowLegacy] = useState(!!(legacyDate || legacyYear || currentMatch));

  const isCustom = period === "custom";

  function push(overrides: Record<string, string> = {}) {
    const p = new URLSearchParams();
    const z = overrides.zone ?? zone;
    if (z) p.set("zone", z);
    const c3v = overrides.c3 ?? c3Account;
    if (c3v) p.set("c3", c3v);
    const per = overrides.period ?? period;
    p.set("period", per);
    if (per === "custom") {
      const s = overrides.start ?? start;
      const e = overrides.end ?? end;
      if (s) p.set("start", s);
      if (e) p.set("end", e);
    }
    // legacy match filter (zone-specific view)
    const m = overrides.match ?? matchId;
    if (m) p.set("match", m);
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
    setC3Account("");
    push({ zone: z, c3: "" });
  }

  function handleC3Change(v: string | null) {
    const c3v = !v || v === "__all__" ? "" : v;
    setC3Account(c3v);
    if (c3v) {
      setZone("");
      push({ c3: c3v, zone: "" });
    } else {
      push({ c3: "" });
    }
  }

  function applyCustom() {
    push({ period: "custom", start, end });
  }

  function reset() {
    setPeriod("today");
    setZone("");
    setC3Account("");
    setStart("");
    setEnd("");
    setMatchId("");
    router.push(`${pathname}?period=today`);
  }

  const hasFilters = !!(zone || c3Account || period !== "today" || (isCustom && (start || end)) || matchId);

  return (
    <div className="space-y-3">
      {/* Main filter row */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Zone filter */}
        {showZoneFilter && zones.length > 0 && (
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

        {/* C3 filter */}
        {showZoneFilter && c3Accounts.length > 0 && (
          <div className="space-y-1.5 w-full sm:w-auto">
            <Label className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
              <Building2 className="h-3 w-3" /> Filtrer par C3
            </Label>
            <Select value={c3Account || "__all__"} onValueChange={handleC3Change}>
              <SelectTrigger className="h-9 w-full sm:w-52 text-sm">
                <SelectValue placeholder="Toutes les C3" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Toutes les C3</SelectItem>
                {c3Accounts.map((c3) => (
                  <SelectItem key={c3.id} value={c3.id}>
                    {c3.name}{c3.city ? ` — ${c3.city}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Period filter */}
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

        {/* Custom date range */}
        {isCustom && (
          <div className="flex flex-wrap items-end gap-2 w-full sm:w-auto">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Début</Label>
              <Input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="h-9 w-36 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Fin</Label>
              <Input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="h-9 w-36 text-sm"
              />
            </div>
            <Button
              size="sm"
              onClick={applyCustom}
              className="h-9 bg-brand hover:bg-brand/90"
              disabled={!start || !end}
            >
              Appliquer
            </Button>
          </div>
        )}

        {/* Legacy match filter toggle (zone-specific view) */}
        {matches.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => setShowLegacy(!showLegacy)}
          >
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            Par match
          </Button>
        )}

        {/* Reset */}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={reset}
            className="h-9 text-muted-foreground hover:text-danger"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Réinitialiser
          </Button>
        )}
      </div>

      {/* Legacy match filter (zone-specific) */}
      {showLegacy && matches.length > 0 && (
        <div className="flex flex-wrap gap-3 items-end bg-muted/30 p-3 rounded-xl border">
          <div className="flex-1 min-w-[200px] space-y-1.5">
            <Label className="text-xs text-muted-foreground">Match spécifique</Label>
            <Select value={matchId} onValueChange={(v) => setMatchId(v ?? "")}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Tous les matchs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tous les matchs</SelectItem>
                {matches.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={() => push()} className="bg-brand hover:bg-brand/90">
            Appliquer
          </Button>
          {matchId && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setMatchId(""); push({ match: "" }); }}
              className="text-danger"
            >
              <X className="h-3.5 w-3.5 mr-1" /> Retirer
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

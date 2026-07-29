"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter, X } from "lucide-react";
import { useState, useEffect } from "react";

interface FondateurFiltersProps {
  superAdmins: { id: string; name: string }[];
  zones: { id: string; name: string }[];
  c3Accounts: { id: string; name: string }[];
}

export function FondateurFilters({ superAdmins, zones, c3Accounts }: FondateurFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentYear = searchParams.get("year") || "";
  const currentSA = searchParams.get("sa") || "";
  const currentZone = searchParams.get("zone") || "";
  const currentC3 = searchParams.get("c3") || "";
  const currentDate = searchParams.get("date") || "";
  const currentChartFrom = searchParams.get("chartFrom") || "";
  const currentChartTo = searchParams.get("chartTo") || "";

  const [year, setYear] = useState(currentYear);
  const [sa, setSa] = useState(currentSA);
  const [zone, setZone] = useState(currentZone);
  const [c3, setC3] = useState(currentC3);
  const [date, setDate] = useState(currentDate);
  const [chartFrom, setChartFrom] = useState(currentChartFrom);
  const [chartTo, setChartTo] = useState(currentChartTo);

  const hasActiveFilters = !!(currentYear || currentSA || currentZone || currentC3 || currentDate || currentChartFrom || currentChartTo);
  const [showFilters, setShowFilters] = useState(hasActiveFilters);

  useEffect(() => {
    setYear(searchParams.get("year") || "");
    setSa(searchParams.get("sa") || "");
    setZone(searchParams.get("zone") || "");
    setC3(searchParams.get("c3") || "");
    setDate(searchParams.get("date") || "");
    setChartFrom(searchParams.get("chartFrom") || "");
    setChartTo(searchParams.get("chartTo") || "");
  }, [searchParams]);

  const currentYearNum = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => String(currentYearNum - i));

  function applyFilters() {
    const params = new URLSearchParams();
    if (date) params.set("date", date);
    else if (year) params.set("year", year);
    if (sa) params.set("sa", sa);
    if (zone) params.set("zone", zone);
    if (c3) params.set("c3", c3);
    if (chartFrom) params.set("chartFrom", chartFrom);
    if (chartTo) params.set("chartTo", chartTo);
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearFilters() {
    setYear(""); setSa(""); setZone(""); setC3(""); setDate(""); setChartFrom(""); setChartTo("");
    router.push(pathname);
  }

  function handleDateChange(val: string) {
    setDate(val);
    if (val) setYear("");
  }

  function handleYearChange(val: string | null) {
    setYear(val ?? "");
    if (val) setDate("");
  }

  // Labels for active filter badges
  const saLabel = currentSA ? superAdmins.find((s) => s.id === currentSA)?.name : null;
  const zoneLabel = currentZone ? zones.find((z) => z.id === currentZone)?.name : null;
  const c3Label = currentC3 ? c3Accounts.find((c) => c.id === currentC3)?.name : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center flex-wrap gap-2">
        <Button
          type="button"
          variant={showFilters ? "default" : "outline"}
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className={showFilters ? "bg-amber-600 hover:bg-amber-700" : ""}
        >
          <Filter className="h-4 w-4 mr-1" />
          Filtres
        </Button>
        {hasActiveFilters && (
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="text-danger">
            <X className="h-4 w-4 mr-1" />
            Réinitialiser
          </Button>
        )}
        {currentDate && (
          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
            {new Date(currentDate + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
          </span>
        )}
        {currentYear && !currentDate && (
          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">{currentYear}</span>
        )}
        {saLabel && (
          <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-medium">
            ODCAV : {saLabel}
          </span>
        )}
        {zoneLabel && (
          <span className="text-xs bg-brand/10 text-brand px-2 py-0.5 rounded-full font-medium">
            Zone : {zoneLabel}
          </span>
        )}
        {c3Label && (
          <span className="text-xs bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full font-medium">
            C3 : {c3Label}
          </span>
        )}
        {(currentChartFrom || currentChartTo) && (
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium">
            Graphique : {currentChartFrom || "..."} → {currentChartTo || "..."}
          </span>
        )}
      </div>

      {showFilters && (
        <div className="flex flex-col gap-4 bg-muted/30 p-3 rounded-lg border">

          {/* Filtres période */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Période</p>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Date précise</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-44"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Année</Label>
                <Select value={year} onValueChange={handleYearChange}>
                  <SelectTrigger className="w-32"><SelectValue placeholder="Toutes" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Toutes</SelectItem>
                    {years.map((y) => (<SelectItem key={y} value={y}>{y}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Filtres entités */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Filtrer par compte</p>
            <div className="flex flex-wrap gap-3 items-end">
              {superAdmins.length > 0 && (
                <div className="space-y-1 min-w-[180px]">
                  <Label className="text-xs">ODCAV / Super Admin</Label>
                  <Select value={sa} onValueChange={(v) => { setSa(v ?? ""); }}>
                    <SelectTrigger><SelectValue placeholder="Tous" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Tous</SelectItem>
                      {superAdmins.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {zones.length > 0 && (
                <div className="space-y-1 min-w-[180px]">
                  <Label className="text-xs">Zone</Label>
                  <Select value={zone} onValueChange={(v) => setZone(v ?? "")}>
                    <SelectTrigger><SelectValue placeholder="Toutes" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Toutes</SelectItem>
                      {zones.map((z) => (<SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {c3Accounts.length > 0 && (
                <div className="space-y-1 min-w-[180px]">
                  <Label className="text-xs">C3</Label>
                  <Select value={c3} onValueChange={(v) => setC3(v ?? "")}>
                    <SelectTrigger><SelectValue placeholder="Tous" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Tous</SelectItem>
                      {c3Accounts.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* Filtres graphique frais plateforme */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Période du graphique</p>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Du</Label>
                <Input
                  type="date"
                  value={chartFrom}
                  onChange={(e) => setChartFrom(e.target.value)}
                  className="w-44"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Au</Label>
                <Input
                  type="date"
                  value={chartTo}
                  onChange={(e) => setChartTo(e.target.value)}
                  className="w-44"
                />
              </div>
              <p className="text-xs text-muted-foreground self-end pb-2">
                Par défaut : 15 derniers jours
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={applyFilters} className="bg-amber-600 hover:bg-amber-700 h-8">
              Appliquer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

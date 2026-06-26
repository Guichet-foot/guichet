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
import { useState } from "react";

interface DashboardFiltersProps {
  matches: { id: string; label: string }[];
}

export function DashboardFilters({ matches }: DashboardFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentDate = searchParams.get("date") || "";
  const currentYear = searchParams.get("year") || "";
  const currentMatch = searchParams.get("match") || "";
  const zone = searchParams.get("zone") || "";

  const [date, setDate] = useState(currentDate);
  const [year, setYear] = useState(currentYear);
  const [matchId, setMatchId] = useState(currentMatch);
  const [showFilters, setShowFilters] = useState(
    !!(currentDate || currentYear || currentMatch)
  );

  const currentYearNum = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => String(currentYearNum - i));

  function applyFilters() {
    const params = new URLSearchParams();
    if (zone) params.set("zone", zone);
    if (date) params.set("date", date);
    if (year && !date) params.set("year", year);
    if (matchId) params.set("match", matchId);
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearFilters() {
    setDate("");
    setYear("");
    setMatchId("");
    const params = new URLSearchParams();
    if (zone) params.set("zone", zone);
    router.push(`${pathname}?${params.toString()}`);
  }

  const hasFilters = !!(currentDate || currentYear || currentMatch);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={showFilters ? "default" : "outline"}
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className={showFilters ? "bg-brand hover:bg-brand/90" : ""}
        >
          <Filter className="h-4 w-4 mr-1" />
          Filtres
        </Button>
        {hasFilters && (
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="text-danger">
            <X className="h-4 w-4 mr-1" />
            Réinitialiser
          </Button>
        )}
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-3 items-end bg-muted/30 p-3 rounded-lg border">
          <div className="space-y-1">
            <Label className="text-xs">Date</Label>
            <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setYear(""); }} className="w-40 h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Année</Label>
            <Select value={year} onValueChange={(v) => { setYear(v ?? ""); setDate(""); }}>
              <SelectTrigger><SelectValue placeholder="Toutes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Toutes</SelectItem>
                {years.map((y) => (<SelectItem key={y} value={y}>{y}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 flex-1 min-w-[200px]">
            <Label className="text-xs">Match</Label>
            <Select value={matchId} onValueChange={(v) => setMatchId(v ?? "")}>
              <SelectTrigger><SelectValue placeholder="Tous les matchs" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tous les matchs</SelectItem>
                {matches.map((m) => (<SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" size="sm" onClick={applyFilters} className="bg-brand hover:bg-brand/90 h-8">
            Appliquer
          </Button>
        </div>
      )}
    </div>
  );
}

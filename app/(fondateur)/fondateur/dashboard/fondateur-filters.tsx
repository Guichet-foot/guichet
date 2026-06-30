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

interface FondateurFiltersProps {
  superAdmins: { id: string; name: string }[];
}

export function FondateurFilters({ superAdmins }: FondateurFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentYear = searchParams.get("year") || "";
  const currentSA = searchParams.get("sa") || "";
  const currentDate = searchParams.get("date") || "";

  const [year, setYear] = useState(currentYear);
  const [sa, setSa] = useState(currentSA);
  const [date, setDate] = useState(currentDate);
  const [showFilters, setShowFilters] = useState(!!(currentYear || currentSA || currentDate));

  const currentYearNum = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => String(currentYearNum - i));

  const hasActiveFilters = !!(currentYear || currentSA || currentDate);

  function applyFilters() {
    const params = new URLSearchParams();
    if (date) params.set("date", date);
    else if (year) params.set("year", year);
    if (sa) params.set("sa", sa);
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearFilters() {
    setYear(""); setSa(""); setDate("");
    router.push(pathname);
  }

  // Quand on sélectionne une date, on vide l'année (la date est plus précise)
  function handleDateChange(val: string) {
    setDate(val);
    if (val) setYear("");
  }

  // Quand on sélectionne une année, on vide la date
  function handleYearChange(val: string | null) {
    setYear(val ?? "");
    if (val) setDate("");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button type="button" variant={showFilters ? "default" : "outline"} size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className={showFilters ? "bg-amber-600 hover:bg-amber-700" : ""}>
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
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-3 items-end bg-muted/30 p-3 rounded-lg border">
          {/* Filtre par date précise */}
          <div className="space-y-1">
            <Label className="text-xs">Date précise</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-44"
            />
          </div>

          {/* OU filtre par année */}
          <div className="space-y-1">
            <Label className="text-xs">Année (si pas de date)</Label>
            <Select value={year} onValueChange={handleYearChange}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Toutes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Toutes</SelectItem>
                {years.map((y) => (<SelectItem key={y} value={y}>{y}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtre par super admin */}
          {superAdmins.length > 0 && (
            <div className="space-y-1 flex-1 min-w-[180px]">
              <Label className="text-xs">Super Admin</Label>
              <Select value={sa} onValueChange={(v) => setSa(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Tous" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tous</SelectItem>
                  {superAdmins.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button type="button" size="sm" onClick={applyFilters} className="bg-amber-600 hover:bg-amber-700 h-8">
            Appliquer
          </Button>
        </div>
      )}
    </div>
  );
}

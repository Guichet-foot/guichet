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

  const [year, setYear] = useState(currentYear);
  const [sa, setSa] = useState(currentSA);
  const [showFilters, setShowFilters] = useState(!!(currentYear || currentSA));

  const currentYearNum = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => String(currentYearNum - i));

  function applyFilters() {
    const params = new URLSearchParams();
    if (year) params.set("year", year);
    if (sa) params.set("sa", sa);
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearFilters() {
    setYear(""); setSa("");
    router.push(pathname);
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
        {(currentYear || currentSA) && (
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="text-danger">
            <X className="h-4 w-4 mr-1" />
            Réinitialiser
          </Button>
        )}
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-3 items-end bg-muted/30 p-3 rounded-lg border">
          <div className="space-y-1">
            <Label className="text-xs">Année</Label>
            <Select value={year} onValueChange={(v) => setYear(v ?? "")}>
              <SelectTrigger><SelectValue placeholder="Toutes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Toutes</SelectItem>
                {years.map((y) => (<SelectItem key={y} value={y}>{y}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
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

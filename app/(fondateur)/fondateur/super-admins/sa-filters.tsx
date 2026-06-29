"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Filter, X, Search } from "lucide-react";
import { useState } from "react";

export function SAFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentSearch = searchParams.get("q") || "";
  const currentStatus = searchParams.get("status") || "";

  const [search, setSearch] = useState(currentSearch);
  const [showFilters, setShowFilters] = useState(!!currentSearch || !!currentStatus);

  function applyFilters() {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearFilters() {
    setSearch("");
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
        {currentSearch && (
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="text-danger">
            <X className="h-4 w-4 mr-1" />
            Réinitialiser
          </Button>
        )}
      </div>

      {showFilters && (
        <div className="flex gap-3 items-end bg-muted/30 p-3 rounded-lg border">
          <div className="space-y-1 flex-1">
            <Label className="text-xs">Rechercher</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
              placeholder="Nom du super admin..."
              className="h-8"
            />
          </div>
          <Button type="button" size="sm" onClick={applyFilters} className="bg-amber-600 hover:bg-amber-700 h-8">
            <Search className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

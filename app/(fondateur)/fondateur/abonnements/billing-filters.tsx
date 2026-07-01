"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useCallback } from "react";
import { Search, X, SlidersHorizontal, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface BillingFiltersProps {
  zones: { id: string; name: string }[];
  years: number[];
}

export function BillingFilters({ zones, years }: BillingFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [expanded, setExpanded] = useState(false);

  const q = searchParams.get("q") || "";
  const zone = searchParams.get("zone") || "";
  const status = searchParams.get("status") || "";
  const year = searchParams.get("year") || "";
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";

  const [search, setSearch] = useState(q);

  const navigate = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v) params.set(k, v);
        else params.delete(k);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  function setQuickPeriod(period: string) {
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().split("T")[0];
    if (period === "today") {
      const t = fmt(today);
      navigate({ from: t, to: t, year: "", year_preset: "" });
    } else if (period === "7d") {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      navigate({ from: fmt(d), to: fmt(today), year: "" });
    } else if (period === "30d") {
      const d = new Date(today);
      d.setDate(d.getDate() - 29);
      navigate({ from: fmt(d), to: fmt(today), year: "" });
    } else if (period === "month") {
      const d = new Date(today.getFullYear(), today.getMonth(), 1);
      navigate({ from: fmt(d), to: fmt(today), year: "" });
    }
  }

  const activeCount = [q, zone, status, year, from, to].filter(Boolean).length;

  function clearAll() {
    setSearch("");
    router.push(pathname);
  }

  return (
    <div className="space-y-3">
      {/* Search + toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") navigate({ q: search });
            }}
            onBlur={() => { if (search !== q) navigate({ q: search }); }}
            placeholder="Rechercher par zone ou référence…"
            className="pl-9 h-9"
          />
          {search && (
            <button
              onClick={() => { setSearch(""); navigate({ q: "" }); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="h-9 gap-1.5 shrink-0"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtres
          {activeCount > 0 && (
            <Badge className="h-4 w-4 p-0 text-[10px] flex items-center justify-center bg-amber-600 text-white">
              {activeCount}
            </Badge>
          )}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </Button>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="h-9 text-muted-foreground">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Expanded filters */}
      {expanded && (
        <div className="border rounded-xl p-4 space-y-4 bg-muted/30">
          {/* Quick periods */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Période rapide</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Aujourd'hui", value: "today" },
                { label: "7 derniers jours", value: "7d" },
                { label: "30 derniers jours", value: "30d" },
                { label: "Ce mois", value: "month" },
              ].map((p) => (
                <Button
                  key={p.value}
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickPeriod(p.value)}
                  className="h-7 text-xs"
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Période personnalisée</p>
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-5">Du</span>
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => navigate({ from: e.target.value, year: "" })}
                  className="h-8 text-sm w-40"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-5">Au</span>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => navigate({ to: e.target.value, year: "" })}
                  className="h-8 text-sm w-40"
                />
              </div>
              {(from || to) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate({ from: "", to: "" })}
                  className="h-8 text-xs text-muted-foreground"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Effacer
                </Button>
              )}
            </div>
          </div>

          {/* Year */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Année</p>
            <div className="flex flex-wrap gap-2">
              {years.map((y) => (
                <Button
                  key={y}
                  variant={year === String(y) ? "default" : "outline"}
                  size="sm"
                  onClick={() => navigate({ year: year === String(y) ? "" : String(y), from: "", to: "" })}
                  className={`h-7 text-xs ${year === String(y) ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}`}
                >
                  {y}
                </Button>
              ))}
            </div>
          </div>

          {/* Zone + Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Zone</p>
              <select
                value={zone}
                onChange={(e) => navigate({ zone: e.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">Toutes les zones</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>{z.name}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Statut</p>
              <select
                value={status}
                onChange={(e) => navigate({ status: e.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">Tous les statuts</option>
                <option value="success">Confirmé</option>
                <option value="pending">En attente</option>
                <option value="failed">Échoué</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Active filters badges */}
      {activeCount > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {q && (
            <Badge variant="secondary" className="gap-1">
              Recherche : «{q}»
              <button onClick={() => { setSearch(""); navigate({ q: "" }); }}><X className="h-3 w-3" /></button>
            </Badge>
          )}
          {zone && (
            <Badge variant="secondary" className="gap-1">
              Zone : {zones.find((z) => z.id === zone)?.name || zone}
              <button onClick={() => navigate({ zone: "" })}><X className="h-3 w-3" /></button>
            </Badge>
          )}
          {status && (
            <Badge variant="secondary" className="gap-1">
              {status === "success" ? "Confirmé" : status === "pending" ? "En attente" : "Échoué"}
              <button onClick={() => navigate({ status: "" })}><X className="h-3 w-3" /></button>
            </Badge>
          )}
          {year && (
            <Badge variant="secondary" className="gap-1">
              Année {year}
              <button onClick={() => navigate({ year: "" })}><X className="h-3 w-3" /></button>
            </Badge>
          )}
          {(from || to) && (
            <Badge variant="secondary" className="gap-1">
              {from && to ? `${from} → ${to}` : from ? `Depuis ${from}` : `Jusqu'au ${to}`}
              <button onClick={() => navigate({ from: "", to: "" })}><X className="h-3 w-3" /></button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

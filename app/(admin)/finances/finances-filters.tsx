"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Period = "jour" | "mois" | "custom";

interface FinancesFiltersProps {
  currentPeriod: Period;
  currentDate?: string;
  currentFrom?: string;
  currentTo?: string;
  currentMatch?: string;
  zoneParam?: string;
  matches?: { id: string; label: string }[];
}

export function FinancesFilters({
  currentPeriod,
  currentDate,
  currentFrom,
  currentTo,
  currentMatch,
  zoneParam,
  matches = [],
}: FinancesFiltersProps) {
  const router = useRouter();
  const todayStr = new Date().toISOString().split("T")[0];
  const [period, setPeriod] = useState<Period>(currentPeriod);
  const [date, setDate] = useState(currentDate || todayStr);
  const [from, setFrom] = useState(currentFrom || "");
  const [to, setTo] = useState(currentTo || "");
  const [match, setMatch] = useState(currentMatch || "");

  function buildUrl(p: Period, d?: string, f?: string, t?: string, m?: string) {
    const params = new URLSearchParams();
    if (zoneParam) params.set("zone", zoneParam);
    if (m) {
      params.set("match", m);
    } else {
      params.set("period", p);
      if (p === "jour" && d) params.set("date", d);
      if (p === "custom") {
        if (f) params.set("from", f);
        if (t) params.set("to", t);
      }
    }
    return `/finances?${params.toString()}`;
  }

  function handlePeriodChange(p: Period) {
    setMatch("");
    setPeriod(p);
    if (p === "jour") router.push(buildUrl("jour", date));
    else if (p === "mois") router.push(buildUrl("mois"));
    // custom: wait for dates
  }

  function handleDateChange(d: string) {
    setDate(d);
    if (period === "jour") router.push(buildUrl("jour", d, undefined, undefined, ""));
  }

  function handleMatchChange(m: string) {
    setMatch(m);
    if (m) {
      router.push(buildUrl(period, date, from, to, m));
    } else {
      router.push(buildUrl(period, date, from, to, ""));
    }
  }

  function applyCustom() {
    if (from && to) router.push(buildUrl("custom", undefined, from, to));
  }

  const tabs: { key: Period; label: string }[] = [
    { key: "jour", label: "Jour" },
    { key: "mois", label: "Mois en cours" },
    { key: "custom", label: "Personnalisé" },
  ];

  return (
    <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => handlePeriodChange(key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              period === key && !match
                ? "bg-brand text-white"
                : "bg-white border border-border text-muted-foreground hover:border-brand/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {period === "jour" && !match && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={date}
            onChange={(e) => handleDateChange(e.target.value)}
            max={todayStr}
            className="w-auto"
          />
        </div>
      )}

      {period === "custom" && !match && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Du</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              max={todayStr}
              className="w-auto"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Au</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              min={from}
              max={todayStr}
              className="w-auto"
            />
          </div>
          <Button
            size="sm"
            onClick={applyCustom}
            disabled={!from || !to}
            className="bg-brand hover:bg-brand/90"
          >
            Appliquer
          </Button>
        </div>
      )}

      {matches.length > 0 && (
        <div className="flex items-center gap-2 pt-1 border-t border-border/50">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">Match :</Label>
          <select
            value={match}
            onChange={(e) => handleMatchChange(e.target.value)}
            className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">— Tous les matchs —</option>
            {matches.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
          {match && (
            <button
              type="button"
              onClick={() => handleMatchChange("")}
              className="text-xs text-muted-foreground hover:text-foreground underline whitespace-nowrap"
            >
              Effacer
            </button>
          )}
        </div>
      )}
    </div>
  );
}

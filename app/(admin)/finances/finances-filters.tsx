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
  zoneParam?: string;
}

export function FinancesFilters({
  currentPeriod,
  currentDate,
  currentFrom,
  currentTo,
  zoneParam,
}: FinancesFiltersProps) {
  const router = useRouter();
  const todayStr = new Date().toISOString().split("T")[0];
  const [period, setPeriod] = useState<Period>(currentPeriod);
  const [date, setDate] = useState(currentDate || todayStr);
  const [from, setFrom] = useState(currentFrom || "");
  const [to, setTo] = useState(currentTo || "");

  function buildUrl(p: Period, d?: string, f?: string, t?: string) {
    const params = new URLSearchParams();
    if (zoneParam) params.set("zone", zoneParam);
    params.set("period", p);
    if (p === "jour" && d) params.set("date", d);
    if (p === "custom") {
      if (f) params.set("from", f);
      if (t) params.set("to", t);
    }
    return `/finances?${params.toString()}`;
  }

  function handlePeriodChange(p: Period) {
    setPeriod(p);
    if (p === "jour") router.push(buildUrl("jour", date));
    else if (p === "mois") router.push(buildUrl("mois"));
    // custom: wait for user to fill dates
  }

  function handleDateChange(d: string) {
    setDate(d);
    if (period === "jour") router.push(buildUrl("jour", d));
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
              period === key
                ? "bg-brand text-white"
                : "bg-white border border-border text-muted-foreground hover:border-brand/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {period === "jour" && (
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

      {period === "custom" && (
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
    </div>
  );
}

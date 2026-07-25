"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Period = "24h" | "jour" | "mois" | "custom";

interface InterFiltersProps {
  typeParam: string;
  currentPeriod: Period;
  currentDate?: string;
  currentFrom?: string;
  currentTo?: string;
  currentMatch?: string;
  matches?: { id: string; label: string }[];
  c3Accounts?: { id: string; name: string; city?: string | null }[];
  currentC3?: string;
}

export function InterFilters({
  typeParam,
  currentPeriod,
  currentDate,
  currentFrom,
  currentTo,
  currentMatch,
  matches = [],
  c3Accounts = [],
  currentC3 = "",
}: InterFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const todayStr = new Date().toISOString().split("T")[0];
  const [period, setPeriod] = useState<Period>(currentPeriod ?? "24h");
  const [date, setDate] = useState(currentDate || todayStr);
  const [from, setFrom] = useState(currentFrom || "");
  const [to, setTo] = useState(currentTo || "");
  const [match, setMatch] = useState(currentMatch || "");
  const [c3Account, setC3Account] = useState(currentC3);

  function buildUrl(p: Period, d?: string, f?: string, t?: string, m?: string, c3?: string) {
    const params = new URLSearchParams();
    params.set("type", typeParam);
    if (c3) params.set("c3", c3);
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
    return `${pathname}?${params.toString()}`;
  }

  function handlePeriodChange(p: Period) {
    setMatch("");
    setPeriod(p);
    if (p === "24h") router.push(buildUrl("24h", undefined, undefined, undefined, undefined, c3Account));
    else if (p === "jour") router.push(buildUrl("jour", date, undefined, undefined, undefined, c3Account));
    else if (p === "mois") router.push(buildUrl("mois", undefined, undefined, undefined, undefined, c3Account));
  }

  function handleDateChange(d: string) {
    setDate(d);
    if (period === "jour") router.push(buildUrl("jour", d, undefined, undefined, undefined, c3Account));
  }

  function handleMatchChange(m: string) {
    setMatch(m);
    router.push(buildUrl(period, date, from, to, m, c3Account));
  }

  function handleC3Change(c3v: string) {
    setC3Account(c3v);
    setMatch("");
    router.push(buildUrl(period, date, from, to, undefined, c3v));
  }

  function applyCustom() {
    if (from && to) router.push(buildUrl("custom", undefined, from, to, undefined, c3Account));
  }

  const tabs: { key: Period; label: string }[] = [
    { key: "24h", label: "24h" },
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

      {typeParam === "communal" && c3Accounts.length > 0 && (
        <div className="flex items-center gap-2 pt-1 border-t border-border/50">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">C3 :</Label>
          <select
            value={c3Account}
            onChange={(e) => handleC3Change(e.target.value)}
            className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">— Toutes les C3 —</option>
            {c3Accounts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.city ? ` — ${c.city}` : ""}
              </option>
            ))}
          </select>
          {c3Account && (
            <button
              type="button"
              onClick={() => handleC3Change("")}
              className="text-xs text-muted-foreground hover:text-foreground underline whitespace-nowrap"
            >
              Effacer
            </button>
          )}
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

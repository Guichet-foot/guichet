"use client";

import { useState, useTransition } from "react";
import { toggleMatchPayment } from "@/lib/actions/finances-actions";
import type { FinanceRow } from "@/lib/actions/finances-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Wallet,
  CheckCircle2,
  XCircle,
  Search,
  TrendingUp,
  Clock,
  Filter,
} from "lucide-react";
import { formatFCFA } from "@/lib/format";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const TYPE_LABELS: Record<string, string> = {
  zone: "Zone",
  c3: "C3",
  odcav: "ODCAV",
};
const TYPE_COLORS: Record<string, string> = {
  zone: "bg-green-100 text-green-800",
  c3: "bg-blue-100 text-blue-800",
  odcav: "bg-purple-100 text-purple-800",
};

function fmtDate(iso: string) {
  return format(new Date(iso + "T12:00:00"), "EEE d MMM yyyy", { locale: fr });
}

function fmtPaidAt(iso: string | null) {
  if (!iso) return null;
  return format(new Date(iso), "dd/MM/yyyy HH:mm", { locale: fr });
}

interface Props {
  rows: FinanceRow[];
}

export function FinancesTable({ rows }: Props) {
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "zone" | "c3" | "odcav">("all");
  const [filterPaid, setFilterPaid] = useState<"all" | "paid" | "unpaid">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalRevenus = rows.reduce((s, r) => s + r.frais, 0);
  const totalPaid = rows.filter((r) => r.paid).reduce((s, r) => s + r.frais, 0);
  const totalUnpaid = totalRevenus - totalPaid;

  // ── Filters ───────────────────────────────────────────────────────────────
  const filtered = rows.filter((r) => {
    if (filterType !== "all" && r.type !== filterType) return false;
    if (filterPaid === "paid" && !r.paid) return false;
    if (filterPaid === "unpaid" && r.paid) return false;
    if (dateFrom && r.date < dateFrom) return false;
    if (dateTo && r.date > dateTo) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !r.matchName.toLowerCase().includes(q) &&
        !r.organisateur.toLowerCase().includes(q) &&
        !r.zoneNames.some((z) => z.toLowerCase().includes(q))
      )
        return false;
    }
    return true;
  });

  function handleToggle(row: FinanceRow) {
    setPendingId(row.matchId);
    startTransition(async () => {
      const result = await toggleMatchPayment(row.matchId, !row.paid);
      setPendingId(null);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(row.paid ? "Marqué comme impayé" : "Marqué comme payé !");
      }
    });
  }

  const hasFilter = filterType !== "all" || filterPaid !== "all" || !!search || !!dateFrom || !!dateTo;

  return (
    <div className="space-y-6">
      {/* ── Summary cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl p-5 bg-green-800 text-white flex items-center justify-between">
          <div>
            <p className="text-white/70 text-xs font-medium">Total Revenus</p>
            <p className="text-2xl font-bold mt-1">{formatFCFA(totalRevenus)}</p>
            <p className="text-white/60 text-[11px] mt-0.5">{rows.length} match{rows.length > 1 ? "s" : ""}</p>
          </div>
          <TrendingUp className="h-10 w-10 text-white/20 shrink-0" />
        </div>

        <div className="rounded-xl p-5 bg-emerald-50 border border-emerald-200 flex items-center justify-between">
          <div>
            <p className="text-emerald-700 text-xs font-medium">Total Payé</p>
            <p className="text-2xl font-bold text-emerald-800 mt-1">{formatFCFA(totalPaid)}</p>
            <p className="text-emerald-600 text-[11px] mt-0.5">
              {rows.filter((r) => r.paid).length} match{rows.filter((r) => r.paid).length > 1 ? "s" : ""}
            </p>
          </div>
          <CheckCircle2 className="h-10 w-10 text-emerald-200 shrink-0" />
        </div>

        <div className="rounded-xl p-5 bg-red-50 border border-red-200 flex items-center justify-between">
          <div>
            <p className="text-red-700 text-xs font-medium">Total Impayé</p>
            <p className="text-2xl font-bold text-red-800 mt-1">{formatFCFA(totalUnpaid)}</p>
            <p className="text-red-600 text-[11px] mt-0.5">
              {rows.filter((r) => !r.paid).length} match{rows.filter((r) => !r.paid).length > 1 ? "s" : ""}
            </p>
          </div>
          <XCircle className="h-10 w-10 text-red-200 shrink-0" />
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium text-muted-foreground">Filtres</span>

          {/* Type */}
          <div className="flex gap-1 flex-wrap">
            {(["all", "zone", "c3", "odcav"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                  filterType === t
                    ? "bg-green-700 text-white border-green-700"
                    : "bg-white text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                {t === "all" ? "Tous" : TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          {/* Statut paiement */}
          <div className="flex gap-1 flex-wrap">
            {(["all", "paid", "unpaid"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterPaid(s)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                  filterPaid === s
                    ? s === "unpaid"
                      ? "bg-red-600 text-white border-red-600"
                      : s === "paid"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-green-700 text-white border-green-700"
                    : "bg-white text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                {s === "all" ? "Tous statuts" : s === "paid" ? "Payés" : "Impayés"}
              </button>
            ))}
          </div>

          {hasFilter && (
            <button
              className="text-xs text-muted-foreground underline ml-auto"
              onClick={() => { setFilterType("all"); setFilterPaid("all"); setSearch(""); setDateFrom(""); setDateTo(""); }}
            >
              Effacer tout
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher match, organisateur, zone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Date range */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Du</span>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 text-xs w-36" />
            <span className="text-xs text-muted-foreground">Au</span>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 text-xs w-36" />
          </div>
        </div>
      </div>

      {/* ── Result count ── */}
      {hasFilter && (
        <p className="text-sm text-muted-foreground">
          {filtered.length} résultat{filtered.length > 1 ? "s" : ""} ·{" "}
          <span className="font-semibold text-foreground">{formatFCFA(filtered.reduce((s, r) => s + r.frais, 0))}</span> ·{" "}
          <span className="text-emerald-700 font-medium">{formatFCFA(filtered.filter((r) => r.paid).reduce((s, r) => s + r.frais, 0))} payé</span> ·{" "}
          <span className="text-red-700 font-medium">{formatFCFA(filtered.filter((r) => !r.paid).reduce((s, r) => s + r.frais, 0))} impayé</span>
        </p>
      )}

      {/* ── Table ── */}
      <div className="rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-32">Date</TableHead>
                <TableHead>Match</TableHead>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead>Organisateur</TableHead>
                <TableHead className="hidden md:table-cell">Zone(s)</TableHead>
                <TableHead className="text-right">Frais</TableHead>
                <TableHead className="text-center w-32">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                    <Wallet className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p>Aucun résultat</p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => {
                  const isLoading = pending && pendingId === row.matchId;
                  return (
                    <TableRow
                      key={row.matchId}
                      className={row.paid ? "bg-emerald-50/40" : undefined}
                    >
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {fmtDate(row.date)}
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {row.matchName}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="secondary" className={`text-xs ${TYPE_COLORS[row.type]}`}>
                          {TYPE_LABELS[row.type]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <p className="font-medium">{row.organisateur}</p>
                        {row.paid && row.paidAt && (
                          <p className="text-[11px] text-emerald-600 flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" />Payé le {fmtPaidAt(row.paidAt)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {row.zoneNames.length > 0 ? row.zoneNames.join(" · ") : "—"}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-sm tabular-nums">
                        {formatFCFA(row.frais)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant={row.paid ? "default" : "outline"}
                          className={`h-7 px-3 text-xs font-semibold transition-all ${
                            row.paid
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
                              : "border-red-400 text-red-600 hover:bg-red-50"
                          }`}
                          onClick={() => handleToggle(row)}
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <span className="animate-pulse">…</span>
                          ) : row.paid ? (
                            <><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Payé</>
                          ) : (
                            <><XCircle className="h-3.5 w-3.5 mr-1" />Impayé</>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

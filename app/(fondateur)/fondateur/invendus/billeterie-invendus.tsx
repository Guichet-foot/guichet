"use client";

import { useState, useEffect } from "react";
import {
  getAllMatchesForBilleterie,
  addMatchesToBilleterie,
  type BilleterieInvendusItem,
  type MatchOption,
} from "@/lib/actions/billeterie-actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  PackageX,
  ArrowRightLeft,
  Ticket,
  ScanLine,
  Loader2,
  Search,
  CalendarDays,
  Shield,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { formatFCFA, formatDateShort } from "@/lib/format";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Props {
  items: BilleterieInvendusItem[];
  canAssign?: boolean;
}

export function BilleterieInvendusList({ items, canAssign = true }: Props) {
  const router = useRouter();
  const [assignModal, setAssignModal] = useState<BilleterieInvendusItem | null>(null);

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          <Ticket className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Aucune billetterie créée.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {items.map((bil) => (
          <Card
            key={bil.id}
            className={bil.isAttributed ? "border-blue-200 opacity-75" : bil.unscannedCount > 0 ? "border-amber-200" : "border-green-200"}
          >
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-base leading-snug">{bil.name}</p>
                    {bil.isAttributed ? (
                      <Badge className="shrink-0 bg-blue-600 text-white gap-1 text-xs">
                        <CheckCircle2 className="h-3 w-3" />
                        Attribué
                      </Badge>
                    ) : bil.unscannedCount > 0 ? (
                      <Badge variant="outline" className="shrink-0 border-amber-400 text-amber-700 gap-1 text-xs">
                        <PackageX className="h-3 w-3" />
                        {bil.unscannedCount} invendu{bil.unscannedCount !== 1 ? "s" : ""}
                      </Badge>
                    ) : (
                      <Badge className="shrink-0 bg-green-600 text-white text-xs">
                        Tout scanné
                      </Badge>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground mt-0.5">
                    {bil.createdAt ? formatDateShort(bil.createdAt) : "—"} · {formatFCFA(bil.price)}
                  </p>

                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-xs">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Ticket className="h-3 w-3" />
                      {bil.totalTickets} billet{bil.totalTickets !== 1 ? "s" : ""}
                    </span>
                    <span className="flex items-center gap-1 text-green-700 font-medium">
                      <ScanLine className="h-3 w-3" />
                      {bil.totalScanned} scanné{bil.totalScanned !== 1 ? "s" : ""}
                    </span>
                    {bil.unscannedCount > 0 && (
                      <span className="flex items-center gap-1 text-amber-700 font-medium">
                        <PackageX className="h-3 w-3" />
                        {bil.unscannedCount} invendu{bil.unscannedCount !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {bil.matches.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/50">
                      {bil.matches[0]?.match_date && (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                          <CalendarDays className="h-3 w-3" />
                          {formatDateShort(bil.matches[0].match_date)}
                        </p>
                      )}
                      <div className="space-y-0.5">
                        {bil.matches.map((m) => (
                          <div key={m.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Shield className="h-3 w-3 shrink-0 text-brand/60" />
                            <span className="font-medium text-foreground/80">
                              {m.home_team} vs {m.away_team}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {canAssign && !bil.isAttributed && bil.unscannedCount > 0 && (
                  <div className="flex items-end shrink-0 self-end pb-0.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs h-8 border-brand text-brand hover:bg-brand/5"
                      onClick={() => setAssignModal(bil)}
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                      Attribuer
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {assignModal && (
        <AssignMatchesDialog
          bil={assignModal}
          onClose={() => setAssignModal(null)}
          onSuccess={() => {
            setAssignModal(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function AssignMatchesDialog({
  bil,
  onClose,
  onSuccess,
}: {
  bil: BilleterieInvendusItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [matches, setMatches] = useState<MatchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  useEffect(() => {
    getAllMatchesForBilleterie().then((data) => {
      // Exclude matches already in the billeterie
      setMatches(data.filter((m) => !bil.matchIds.includes(m.id)));
      setLoading(false);
    });
  }, [bil.matchIds]);

  const filtered = matches.filter((m) => {
    const q = search.toLowerCase();
    return (
      m.home_team.toLowerCase().includes(q) ||
      m.away_team.toLowerCase().includes(q) ||
      (m.venue || "").toLowerCase().includes(q)
    );
  });

  function toggleMatch(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleConfirm() {
    if (selected.size === 0) {
      toast.error("Sélectionnez au moins un match");
      return;
    }
    setSaving(true);
    const result = await addMatchesToBilleterie(bil.id, [...selected]);
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(
      `${selected.size} match${selected.size !== 1 ? "s" : ""} ajouté${selected.size !== 1 ? "s" : ""} à "${bil.name}" — ${bil.unscannedCount} billet${bil.unscannedCount !== 1 ? "s" : ""} invendu${bil.unscannedCount !== 1 ? "s" : ""} maintenant valables pour ces matchs`
    );
    onSuccess();
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-brand" />
            Attribuer les invendus à des matchs
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{bil.name}</span> —{" "}
            <span className="text-amber-700 font-semibold">{bil.unscannedCount} billet{bil.unscannedCount !== 1 ? "s" : ""} invendu{bil.unscannedCount !== 1 ? "s" : ""}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Les matchs sélectionnés seront ajoutés à cette billetterie. Les billets non scannés deviendront automatiquement valables pour ces matchs.
          </p>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un match..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Match list */}
        <div className="max-h-72 overflow-y-auto space-y-1 -mx-1 px-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-brand" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              {matches.length === 0
                ? "Aucun match programmé disponible"
                : "Aucun match correspond à la recherche"}
            </p>
          ) : (
            filtered.map((m) => {
              const isChecked = selected.has(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleMatch(m.id)}
                  className={`w-full text-left flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                    isChecked
                      ? "border-brand bg-brand/5"
                      : "border-border hover:border-brand/30"
                  }`}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => toggleMatch(m.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-tight truncate">
                      {m.home_team} vs {m.away_team}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <CalendarDays className="h-3 w-3 shrink-0" />
                      {formatDateShort(m.match_date)}
                      {m.match_type && ` · ${m.match_type}`}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <DialogFooter className="gap-2">
          {selected.size > 0 && (
            <p className="text-xs text-muted-foreground flex-1 self-center">
              {selected.size} match{selected.size !== 1 ? "s" : ""} sélectionné{selected.size !== 1 ? "s" : ""}
            </p>
          )}
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button
            className="bg-brand hover:bg-brand/90"
            onClick={handleConfirm}
            disabled={saving || selected.size === 0}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              `Attribuer${selected.size > 0 ? ` (${selected.size})` : ""}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

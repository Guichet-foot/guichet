"use client";

import { useMemo, useState } from "react";
import { BilleterieCardActions } from "@/app/(admin)/billeterie/billeterie-card-actions";
import { BilleteriedonneToggle } from "./billeterie-done-toggle";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Ticket, Search, Package, X, CalendarRange } from "lucide-react";
import Link from "next/link";
import { formatFCFA } from "@/lib/format";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { BilleterieItem } from "@/lib/actions/billeterie-actions";

export function FondateurBilleterieList({ items }: { items: BilleterieItem[] }) {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (search.trim() && !item.name.toLowerCase().includes(search.trim().toLowerCase())) {
        return false;
      }
      if (dateFrom || dateTo) {
        const created = new Date(item.createdAt);
        if (dateFrom) {
          const from = new Date(dateFrom + "T00:00:00");
          if (created < from) return false;
        }
        if (dateTo) {
          const to = new Date(dateTo + "T23:59:59.999");
          if (created > to) return false;
        }
      }
      return true;
    });
  }, [items, search, dateFrom, dateTo]);

  const hasFilters = !!search || !!dateFrom || !!dateTo;

  function clearFilters() {
    setSearch("");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 bg-muted/30 border border-border rounded-lg p-4">
        <div className="flex-1 min-w-[200px] space-y-1">
          <Label className="text-xs text-muted-foreground">Rechercher</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nom du pass…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Du</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-auto"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Au</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            min={dateFrom}
            className="w-auto"
          />
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
            <X className="h-3.5 w-3.5 mr-1" />
            Effacer
          </Button>
        )}
      </div>

      {hasFilters && (
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <CalendarRange className="h-3.5 w-3.5" />
          {filtered.length} résultat{filtered.length !== 1 ? "s" : ""} sur {items.length}
        </p>
      )}

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Ticket className="h-12 w-12 mb-4" />
            <p className="font-medium mb-1">
              {hasFilters ? "Aucun résultat" : "Aucun pass créé"}
            </p>
            <p className="text-sm">
              {hasFilters
                ? "Essayez une autre recherche ou une autre période."
                : "Créez un pass multi-matchs pour regrouper plusieurs matchs sur un seul billet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <div key={item.id} className="relative group">
              <Link href={`/fondateur/billeterie/${item.id}`} className="block h-full">
                <Card className={`hover:border-brand/40 transition-colors cursor-pointer h-full ${item.isDone ? "opacity-60 bg-muted/40" : ""}`}>
                  <CardContent className="pt-5 pb-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className={`font-bold text-base leading-tight pr-16 ${item.isDone ? "line-through text-muted-foreground" : ""}`}>
                          {item.name}
                        </p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {format(new Date(item.createdAt), "d MMM yyyy", { locale: fr })}
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {item.matchIds.length} match{item.matchIds.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border">
                      <span className="text-sm font-semibold text-brand">
                        {formatFCFA(item.price)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {item.totalTickets} billet{item.totalTickets !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {!!item.blocksOrdered && item.blocksOrdered > 0 && (
                      <div className="flex items-center justify-between pt-1 border-t border-border">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          Blocs commandés
                        </span>
                        <span className="text-xs font-medium">
                          {item.blocksOrdered}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
              {/* Toggle "terminée" — toujours visible */}
              <div className="absolute top-3 left-3 z-10">
                <BilleteriedonneToggle id={item.id} isDone={item.isDone} />
              </div>
              <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity sm:opacity-100">
                <BilleterieCardActions
                  item={{
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    categories: item.categories,
                    matchIds: item.matchIds,
                    blocksOrdered: item.blocksOrdered,
                    blockOrderDate: item.blockOrderDate,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

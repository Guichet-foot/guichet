"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { createTickets, sellBlocTickets, getMatchCategoriesForSale } from "@/lib/actions/ticket-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Printer, ShoppingCart, Minus, Plus, Banknote } from "lucide-react";
import { toast } from "sonner";
import { formatFCFA } from "@/lib/format";
import { CATEGORY_COLORS } from "@/lib/constants";

type PrintFormat = "58" | "80";
const PRINT_FORMAT_KEY = "gf_print_format";

interface MatchOption {
  id: string;
  home_team: string;
  away_team: string;
  match_date: string;
  venue: string;
  vente_active: boolean;
}

interface CategoryOption {
  id: string;
  name: string;
  price: number;
  sold_count: number;
}

function VenteContent() {
  const [matches, setMatches] = useState<MatchOption[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryOption | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [vendrLoading, setVendreLoading] = useState(false);
  const [todaySales, setTodaySales] = useState({ count: 0, total: 0 });
  const [initialLoading, setInitialLoading] = useState(true);
  const [printFormat, setPrintFormat] = useState<PrintFormat>("80");

  useEffect(() => {
    const saved = localStorage.getItem(PRINT_FORMAT_KEY) as PrintFormat | null;
    if (saved === "58" || saved === "80") setPrintFormat(saved);
  }, []);

  function toggleFormat(fmt: PrintFormat) {
    setPrintFormat(fmt);
    localStorage.setItem(PRINT_FORMAT_KEY, fmt);
  }

  const loadCategories = useCallback(async (matchId: string) => {
    const cats = await getMatchCategoriesForSale(matchId);
    setCategories(cats);
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("zone_id, created_by_admin")
          .eq("id", user.id)
          .single();

        if (!profile?.zone_id && !profile?.created_by_admin) return;

        let matchQuery = supabase
          .from("matches")
          .select("id, home_team, away_team, match_date, venue, vente_active")
          .in("status", ["programme", "en_cours"])
          .order("match_date", { ascending: true });

        if (profile.zone_id) {
          matchQuery = matchQuery.eq("zone_id", profile.zone_id);
        } else {
          matchQuery = matchQuery.eq("c3_account_id", profile.created_by_admin);
        }

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const [{ data: matchList }, { data: todayTickets }] = await Promise.all([
          matchQuery,
          supabase
            .from("tickets")
            .select("price")
            .eq("sold_by", user.id)
            .gte("sold_at", todayStart.toISOString())
            .neq("status", "annule"),
        ]);

        if (matchList && matchList.length > 0) {
          setMatches(matchList);
          const firstActive = matchList.find((m: any) => m.vente_active) || matchList[0];
          setSelectedMatchId(firstActive.id);
          await loadCategories(firstActive.id);
        }

        if (todayTickets) {
          setTodaySales({
            count: todayTickets.length,
            total: todayTickets.reduce((sum, t) => sum + t.price, 0),
          });
        }
      } finally {
        setInitialLoading(false);
      }
    }
    init();
  }, [loadCategories]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (sheetOpen && e.key === "Enter") {
        e.preventDefault();
        handleConfirm();
        return;
      }
      const num = parseInt(e.key);
      if (!sheetOpen && num >= 1 && num <= categories.length) {
        setSelectedCategory(categories[num - 1]);
        setSheetOpen(true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  async function handleMatchChange(matchId: string) {
    setSelectedMatchId(matchId);
    await loadCategories(matchId);
  }

  function handleCategoryClick(cat: CategoryOption) {
    setSelectedCategory(cat);
    setQuantity(1);
    setSheetOpen(true);
  }

  async function handleConfirm() {
    if (!selectedCategory || loading) return;
    setLoading(true);

    const result = await createTickets(selectedMatchId, selectedCategory.id, quantity);

    if (result.error) {
      toast.error(result.error);
      setLoading(false);
      return;
    }

    toast.success(quantity > 1 ? `${quantity} billets imprimés !` : "Billet imprimé !");
    setTodaySales((prev) => ({
      count: prev.count + quantity,
      total: prev.total + selectedCategory.price * quantity,
    }));
    setCategories((prev) =>
      prev.map((c) =>
        c.id === selectedCategory.id
          ? { ...c, sold_count: c.sold_count + quantity }
          : c
      )
    );
    setSheetOpen(false);
    setSelectedCategory(null);
    setQuantity(1);
    setLoading(false);

    if (result.batchId) {
      window.open(`/api/tickets/print-batch?batch=${result.batchId}&fmt=${printFormat}`, "_blank");
    }
  }

  async function handleVendre() {
    if (!selectedCategory || vendrLoading) return;
    setVendreLoading(true);

    const result = await sellBlocTickets(selectedMatchId, selectedCategory.id, quantity);

    if (result.error) {
      toast.error(result.error);
      setVendreLoading(false);
      return;
    }

    const sold = (result as { sold: number }).sold;
    toast.success(sold > 1 ? `${sold} billets enregistrés !` : "Vente enregistrée !");
    setTodaySales((prev) => ({
      count: prev.count + sold,
      total: prev.total + selectedCategory.price * sold,
    }));
    setCategories((prev) =>
      prev.map((c) =>
        c.id === selectedCategory.id
          ? { ...c, sold_count: c.sold_count + sold }
          : c
      )
    );
    setSheetOpen(false);
    setSelectedCategory(null);
    setQuantity(1);
    setVendreLoading(false);
  }

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-muted-foreground">
        <ShoppingCart className="h-16 w-16 mb-4" />
        <p className="text-lg">Aucun match disponible</p>
        <p className="text-sm">Contactez votre administrateur</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <Card className="bg-brand/5 border-brand/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Vos ventes du jour</p>
              <p className="text-lg font-bold">
                {todaySales.count} billets / {formatFCFA(todaySales.total)}
              </p>
            </div>
            {/* Sélecteur format d'impression */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Printer className="h-3 w-3" />
                Format ticket
              </p>
              <div className="flex rounded-lg border border-brand/30 overflow-hidden text-xs font-semibold">
                <button
                  onClick={() => toggleFormat("58")}
                  className={`px-2.5 py-1.5 transition-colors ${
                    printFormat === "58"
                      ? "bg-brand text-white"
                      : "bg-white text-brand hover:bg-brand/10"
                  }`}
                >
                  58mm
                </button>
                <button
                  onClick={() => toggleFormat("80")}
                  className={`px-2.5 py-1.5 transition-colors border-l border-brand/30 ${
                    printFormat === "80"
                      ? "bg-brand text-white"
                      : "bg-white text-brand hover:bg-brand/10"
                  }`}
                >
                  80mm
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Select value={selectedMatchId} onValueChange={(v) => v && handleMatchChange(v)}>
        <SelectTrigger>
          <SelectValue placeholder="Choisir un match" />
        </SelectTrigger>
        <SelectContent>
          {matches.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.home_team} vs {m.away_team}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {categories.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>Aucune catégorie de billets configurée pour ce match</p>
        </div>
      )}

      {categories.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {categories.map((cat, index) => {
            const colorClass = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
            return (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat)}
                className={`rounded-xl p-6 text-left transition-transform active:scale-95 ${colorClass} min-h-[120px]`}
              >
                <p className="text-lg font-bold">{cat.name}</p>
                <p className="text-3xl font-bold mt-1">
                  {formatFCFA(cat.price)}
                </p>
                <p className="text-sm mt-2 opacity-80">
                  {cat.sold_count} vendus
                </p>
                <p className="text-xs opacity-60 mt-1">
                  Touche {index + 1}
                </p>
              </button>
            );
          })}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="text-center">
              Confirmer la vente
            </SheetTitle>
          </SheetHeader>
          {selectedCategory && (() => {
            const totalPrice = selectedCategory.price * quantity;
            return (
              <div className="py-4 space-y-5">
                {/* Catégorie + prix unitaire */}
                <div className="text-center space-y-1">
                  <p className="text-xl font-bold">{selectedCategory.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatFCFA(selectedCategory.price)} / billet
                  </p>
                </div>

                {/* Sélecteur quantité */}
                <div className="flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    className="w-12 h-12 rounded-full bg-muted flex items-center justify-center disabled:opacity-30 text-xl font-bold active:scale-95 transition-transform"
                  >
                    <Minus className="h-5 w-5" />
                  </button>
                  <div className="text-center w-16">
                    <p className="text-4xl font-bold">{quantity}</p>
                    <p className="text-xs text-muted-foreground">billet(s)</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(30, q + 1))}
                    disabled={quantity >= 30}
                    className="w-12 h-12 rounded-full bg-muted flex items-center justify-center disabled:opacity-30 text-xl font-bold active:scale-95 transition-transform"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>

                {/* Total */}
                <div className="bg-brand/5 rounded-xl py-3 text-center">
                  <p className="text-xs text-muted-foreground mb-0.5">Total à encaisser</p>
                  <p className="text-3xl font-bold text-brand">{formatFCFA(totalPrice)}</p>
                  {quantity > 1 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {quantity} × {formatFCFA(selectedCategory.price)}
                    </p>
                  )}
                </div>

                <Button
                  onClick={handleVendre}
                  disabled={vendrLoading || loading}
                  className="w-full h-16 text-xl font-bold bg-green-600 hover:bg-green-700 text-white"
                >
                  {vendrLoading ? (
                    <Loader2 className="h-7 w-7 animate-spin" />
                  ) : (
                    <>
                      <Banknote className="h-7 w-7 mr-3" />
                      VENDRE {quantity > 1 ? `${quantity} BILLETS` : ""}
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleConfirm}
                  disabled={loading || vendrLoading}
                  variant="outline"
                  className="w-full h-11 text-sm font-semibold border-brand text-brand hover:bg-brand/10"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Printer className="h-4 w-4 mr-2" />
                      Imprimer {quantity > 1 ? `${quantity} billets` : "le billet"}
                    </>
                  )}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Max 30 billet(s) par opération
                </p>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function VentePage() {
  return <VenteContent />;
}

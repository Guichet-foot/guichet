"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createExpense } from "@/lib/actions/expense-actions";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/constants";

interface MatchOption {
  id: string;
  home_team: string;
  away_team: string;
}

export default function NewExpensePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [c3AccountId, setC3AccountId] = useState<string | null>(null);
  const [isC3, setIsC3] = useState(false);
  const [matches, setMatches] = useState<MatchOption[]>([]);

  const [matchId, setMatchId] = useState<string>("none");
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const urlParams = new URLSearchParams(window.location.search);
      const zoneParam = urlParams.get("zone");

      const { data: profile } = await supabase
        .from("profiles")
        .select("zone_id, role")
        .eq("id", user.id)
        .single();

      if (profile?.role === "c3") {
        // Compte C3 : les dépenses sont liées à c3_account_id, pas à zone_id
        setIsC3(true);
        setC3AccountId(user.id);

        const { data: matchList } = await supabase
          .from("matches")
          .select("id, home_team, away_team")
          .eq("c3_account_id", user.id)
          .order("match_date", { ascending: false });

        if (matchList) setMatches(matchList);
      } else {
        // admin_zone / super_admin : dépenses liées à zone_id
        const effectiveZone = zoneParam || profile?.zone_id || null;
        setZoneId(effectiveZone);

        if (effectiveZone) {
          const { data: matchList } = await supabase
            .from("matches")
            .select("id, home_team, away_team")
            .eq("zone_id", effectiveZone)
            .order("match_date", { ascending: false });

          if (matchList) setMatches(matchList);
        }
      }
    }
    init();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const finalCategory = category === "autre_custom" ? customCategory : category;

    if (!finalCategory) {
      toast.error("Choisissez une catégorie");
      setLoading(false);
      return;
    }

    if (!isC3 && !zoneId) {
      toast.error("Zone introuvable");
      setLoading(false);
      return;
    }

    const result = await createExpense({
      zoneId: isC3 ? null : zoneId,
      c3AccountId: isC3 ? c3AccountId : null,
      matchId: matchId === "none" ? null : matchId,
      label,
      category: finalCategory,
      amount: parseInt(amount),
      expenseDate,
      notes,
    });

    if (result.error) {
      toast.error(result.error);
      setLoading(false);
      return;
    }

    toast.success("Dépense ajoutée");
    router.push("/finances");
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/finances">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Button>
        </Link>
        <h1 className="text-2xl font-bold font-heading">Nouvelle dépense</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Champ match adapté selon le rôle */}
            <div className="space-y-2">
              <Label>{isC3 ? "Match communal (optionnel)" : "Match (optionnel)"}</Label>
              <Select value={matchId} onValueChange={(v) => setMatchId(v ?? "none")}>
                <SelectTrigger>
                  <SelectValue placeholder={isC3 ? "Toutes les rencontres" : "Dépense globale zone"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {isC3 ? "Toutes les rencontres" : "Global zone"}
                  </SelectItem>
                  {matches.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.home_team} vs {m.away_team}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="label">Libellé</Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
                placeholder="Honoraires arbitres"
              />
            </div>

            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Select
                value={category}
                onValueChange={(v) => {
                  setCategory(v ?? "");
                  if (v !== "autre_custom") setCustomCategory("");
                }}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EXPENSE_CATEGORY_LABELS)
                    .filter(([key]) => key !== "autre")
                    .map(([value, lbl]) => (
                      <SelectItem key={value} value={value}>
                        {lbl}
                      </SelectItem>
                    ))}
                  <SelectItem value="autre_custom">Autre (personnalisée)</SelectItem>
                </SelectContent>
              </Select>
              {category === "autre_custom" && (
                <Input
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  required
                  placeholder="Nom de la catégorie"
                  className="mt-2"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Montant (FCFA)</Label>
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                min="1"
                placeholder="25000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optionnel)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Détails..."
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-brand hover:bg-brand/90"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Enregistrer"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

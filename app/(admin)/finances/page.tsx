import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Banknote, TrendingDown, TrendingUp } from "lucide-react";
import { formatFCFA, formatDate } from "@/lib/format";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/constants";

export const metadata = { title: "Finances" };

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function FinancesPage() {
  const profile = await requireRole(["super_admin", "admin_zone"]);
  const supabase = await createClient();

  const zoneId =
    profile.role === "admin_zone" ? profile.zone_id : null;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data: tickets } = await supabase
    .from("tickets")
    .select(
      "price, match_id, match:matches(home_team, away_team, match_date, zone_id)"
    )
    .gte("sold_at", monthStart.toISOString())
    .neq("status", "annule") as { data: any[] | null };

  const filteredTickets = zoneId
    ? tickets?.filter((t: any) => t.match?.zone_id === zoneId)
    : tickets;

  const totalRevenue =
    filteredTickets?.reduce((sum: number, t: any) => sum + t.price, 0) || 0;

  // Revenue by match
  const revenueByMatch: Record<
    string,
    {
      homeTeam: string;
      awayTeam: string;
      date: string;
      sold: number;
      revenue: number;
    }
  > = {};

  filteredTickets?.forEach((t: any) => {
    if (!t.match) return;
    if (!revenueByMatch[t.match_id]) {
      revenueByMatch[t.match_id] = {
        homeTeam: t.match.home_team,
        awayTeam: t.match.away_team,
        date: t.match.match_date,
        sold: 0,
        revenue: 0,
      };
    }
    revenueByMatch[t.match_id].sold++;
    revenueByMatch[t.match_id].revenue += t.price;
  });

  // Expenses
  let expensesQuery = supabase
    .from("expenses")
    .select("*, match:matches(home_team, away_team), adder:profiles!expenses_added_by_fkey(full_name)")
    .gte("expense_date", monthStart.toISOString().split("T")[0])
    .order("expense_date", { ascending: false });

  if (zoneId) {
    expensesQuery = expensesQuery.eq("zone_id", zoneId);
  }

  const { data: expenses } = await expensesQuery as { data: any[] | null };

  const totalExpenses =
    expenses?.reduce((sum: number, e: any) => sum + e.amount, 0) || 0;
  const balance = totalRevenue - totalExpenses;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Finances</h1>
          <p className="text-muted-foreground">Mois en cours</p>
        </div>
        <Link href="/finances/depenses/nouveau">
          <Button className="bg-brand hover:bg-brand/90">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter une dépense
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Recettes</p>
                <p className="text-2xl font-bold text-brand">
                  {formatFCFA(totalRevenue)}
                </p>
              </div>
              <Banknote className="h-8 w-8 text-brand/40" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Dépenses</p>
                <p className="text-2xl font-bold text-danger">
                  {formatFCFA(totalExpenses)}
                </p>
              </div>
              <TrendingDown className="h-8 w-8 text-danger/40" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Solde net</p>
                <p
                  className={`text-2xl font-bold ${
                    balance >= 0 ? "text-success" : "text-danger"
                  }`}
                >
                  {formatFCFA(balance)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recettes par match</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Match</TableHead>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead className="text-right">Billets</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(revenueByMatch).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Aucune recette ce mois
                  </TableCell>
                </TableRow>
              ) : (
                Object.entries(revenueByMatch).map(([id, data]) => (
                  <TableRow key={id}>
                    <TableCell className="font-medium">
                      {data.homeTeam} vs {data.awayTeam}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm">
                      {formatDate(data.date)}
                    </TableCell>
                    <TableCell className="text-right">{data.sold}</TableCell>
                    <TableCell className="text-right font-bold text-brand">
                      {formatFCFA(data.revenue)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dépenses</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead className="hidden sm:table-cell">Catégorie</TableHead>
                <TableHead className="hidden md:table-cell">Match</TableHead>
                <TableHead className="text-right">Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!expenses || expenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Aucune dépense ce mois
                  </TableCell>
                </TableRow>
              ) : (
                expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="text-sm">
                      {formatDate(expense.expense_date)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {expense.label}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell capitalize">
                      {EXPENSE_CATEGORY_LABELS[expense.category] ||
                        expense.category}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {expense.match
                        ? `${expense.match.home_team} vs ${expense.match.away_team}`
                        : "Global zone"}
                    </TableCell>
                    <TableCell className="text-right font-bold text-danger">
                      -{formatFCFA(expense.amount)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

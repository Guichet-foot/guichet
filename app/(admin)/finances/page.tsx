import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getEffectiveZone } from "@/lib/get-effective-zone";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Banknote, TrendingDown, TrendingUp, Building2, Landmark } from "lucide-react";
import { formatFCFA, formatDate } from "@/lib/format";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/constants";
import { buildZoneUrl } from "@/lib/zone-utils";
import { ZoneCardGrid } from "@/components/zone-card-grid";
import { ZoneBackHeader } from "@/components/zone-back-header";

export const metadata = { title: "Finances" };

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function FinancesPage({
  searchParams,
}: {
  searchParams: Promise<{ zone?: string }>;
}) {
  const profile = await requireRole(["super_admin", "admin_zone"]);
  const params = await searchParams;
  const { effectiveZoneId, selectedZone, ownedZones, needsZoneSelection } =
    await getEffectiveZone(profile, params.zone);

  if (needsZoneSelection) {
    return <ZoneCardGrid zones={ownedZones} title="Finances" />;
  }

  const supabase = await createClient();
  const adminSupabase = await createAdminClient();
  const zoneId = effectiveZoneId;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const today = new Date().toISOString().split("T")[0];

  // Paramètres plateforme effectifs aujourd'hui
  const { data: platformData } = await adminSupabase
    .from("platform_settings")
    .select("frais_plateforme, odcav_rate")
    .lte("effective_date", today)
    .order("effective_date", { ascending: false })
    .limit(1)
    .single();
  const fraisPlateforme = platformData?.frais_plateforme ?? 5000;
  const odcavRate = platformData?.odcav_rate ?? 0.05;

  const { data: tickets } = (await supabase
    .from("tickets")
    .select("price, match_id, sold_at, match:matches(home_team, away_team, match_date, zone_id)")
    .gte("sold_at", monthStart.toISOString())
    .neq("status", "annule")) as { data: any[] | null };

  const filteredTickets = zoneId
    ? tickets?.filter((t: any) => t.match?.zone_id === zoneId)
    : tickets;

  // Jours d'activité ce mois (jours avec au moins une vente)
  const activeDays = new Set(
    filteredTickets?.map((t: any) => (t.sold_at as string)?.split("T")[0]).filter(Boolean) || []
  ).size;

  const totalRevenue = filteredTickets?.reduce((sum: number, t: any) => sum + t.price, 0) || 0;
  const odcavCommission = Math.round(totalRevenue * odcavRate);
  const fraisPlatformeMois = fraisPlateforme * activeDays;

  const revenueByMatch: Record<string, { homeTeam: string; awayTeam: string; date: string; sold: number; revenue: number }> = {};
  filteredTickets?.forEach((t: any) => {
    if (!t.match) return;
    if (!revenueByMatch[t.match_id]) {
      revenueByMatch[t.match_id] = { homeTeam: t.match.home_team, awayTeam: t.match.away_team, date: t.match.match_date, sold: 0, revenue: 0 };
    }
    revenueByMatch[t.match_id].sold++;
    revenueByMatch[t.match_id].revenue += t.price;
  });

  let expensesQuery = supabase
    .from("expenses")
    .select("*, match:matches(home_team, away_team), adder:profiles!expenses_added_by_fkey(full_name)")
    .gte("expense_date", monthStart.toISOString().split("T")[0])
    .order("expense_date", { ascending: false });

  if (zoneId) expensesQuery = expensesQuery.eq("zone_id", zoneId);

  const { data: expenses } = (await expensesQuery) as { data: any[] | null };
  const totalExpenses = expenses?.reduce((sum: number, e: any) => sum + e.amount, 0) || 0;
  const balance = totalRevenue - totalExpenses - odcavCommission - fraisPlatformeMois;

  return (
    <div className="space-y-6 min-w-0">
      {profile.role === "super_admin" && selectedZone && <ZoneBackHeader zoneName={selectedZone.name} />}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading">Finances</h1>
          <p className="text-muted-foreground">Mois en cours</p>
        </div>
        <Link href={buildZoneUrl("/finances/depenses/nouveau", params.zone)}>
          <Button className="bg-brand hover:bg-brand/90">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter une dépense
          </Button>
        </Link>
      </div>

      {/* Ligne 1 : Recettes + Dépenses */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Recettes brutes</p>
                <p className="text-2xl font-bold text-brand">{formatFCFA(totalRevenue)}</p>
                <p className="text-xs text-muted-foreground mt-1">{activeDays} jour(s) d&apos;activité</p>
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
                <p className="text-2xl font-bold text-danger">{formatFCFA(totalExpenses)}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-danger/40" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ligne 2 : Déductions obligatoires */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-blue-200 bg-blue-50/40">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700 font-medium">Commission ODCAV ({(odcavRate * 100).toFixed(0)}%)</p>
                <p className="text-xl font-bold text-blue-800">{formatFCFA(odcavCommission)}</p>
                <p className="text-xs text-blue-600 mt-0.5">À reverser à l&apos;ODCAV</p>
              </div>
              <Landmark className="h-7 w-7 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50/40">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-700 font-medium">Frais plateforme</p>
                <p className="text-xl font-bold text-orange-800">{formatFCFA(fraisPlatformeMois)}</p>
                <p className="text-xs text-orange-600 mt-0.5">{formatFCFA(fraisPlateforme)} × {activeDays} jour(s)</p>
              </div>
              <Building2 className="h-7 w-7 text-orange-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Solde net */}
      <Card className={`border-2 ${balance >= 0 ? "border-success/30 bg-success/5" : "border-danger/30 bg-danger/5"}`}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Net à reverser à la zone</p>
              <p className={`text-3xl font-bold ${balance >= 0 ? "text-success" : "text-danger"}`}>{formatFCFA(Math.max(0, balance))}</p>
              <p className="text-xs text-muted-foreground mt-1">Recettes − Dépenses − ODCAV − Frais plateforme</p>
            </div>
            <TrendingUp className="h-10 w-10 text-muted-foreground/20" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Recettes par match</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
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
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">Aucune recette ce mois</TableCell>
                </TableRow>
              ) : (
                Object.entries(revenueByMatch).map(([id, data]) => (
                  <TableRow key={id}>
                    <TableCell className="font-medium">{data.homeTeam} vs {data.awayTeam}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm">{formatDate(data.date)}</TableCell>
                    <TableCell className="text-right">{data.sold}</TableCell>
                    <TableCell className="text-right font-bold text-brand">{formatFCFA(data.revenue)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Dépenses</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead className="hidden sm:table-cell">Catégorie</TableHead>
                <TableHead className="hidden md:table-cell">Match</TableHead>
                <TableHead className="text-right">Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!expenses || expenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucune dépense ce mois</TableCell>
                </TableRow>
              ) : (
                expenses.map((expense: any) => (
                  <TableRow key={expense.id}>
                    <TableCell className="hidden sm:table-cell text-sm">{formatDate(expense.expense_date)}</TableCell>
                    <TableCell className="font-medium">{expense.label}</TableCell>
                    <TableCell className="hidden sm:table-cell capitalize">{EXPENSE_CATEGORY_LABELS[expense.category] || expense.category}</TableCell>
                    <TableCell className="hidden md:table-cell">{expense.match ? `${expense.match.home_team} vs ${expense.match.away_team}` : "Global zone"}</TableCell>
                    <TableCell className="text-right font-bold text-danger">-{formatFCFA(expense.amount)}</TableCell>
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

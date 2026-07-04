import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard, CheckCircle2, Clock, XCircle, TrendingUp } from "lucide-react";
import { BillingFilters } from "./billing-filters";
import { ManualActivationTrigger } from "./manual-activation-trigger";
import { DeactivateButton } from "./deactivate-button";
import { formatFCFA } from "@/lib/format";

export const metadata = { title: "Abonnements" };

/* eslint-disable @typescript-eslint/no-explicit-any */

const STATUS_COLORS: Record<string, string> = {
  success: "bg-green-100 text-green-800",
  pending:  "bg-amber-100 text-amber-800",
  failed:   "bg-red-100 text-red-800",
};
const STATUS_LABELS: Record<string, string> = {
  success: "Confirmé",
  pending:  "En attente",
  failed:   "Échoué",
};
const METHOD_LABELS: Record<string, string> = {
  wave_senegal: "Wave",
  orange_money_senegal: "Orange Money",
  free_money: "Free Money",
  card: "Carte bancaire",
  cash: "Espèces (manuel)",
};

function formatDT(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) +
    " " +
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  );
}

function formatUntil(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) +
    " le " +
    d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
  );
}

export default async function AbonnementsPage({
  searchParams,
}: {
  searchParams: Promise<{ zone?: string; status?: string; year?: string; from?: string; to?: string; q?: string }>;
}) {
  await requireRole(["fondateur"]);
  const params = await searchParams;
  const supabase = await createAdminClient();

  // Fetch all zones for filter dropdown
  const { data: zonesRaw } = await supabase
    .from("zones")
    .select("id, name")
    .order("name");
  const zones = (zonesRaw || []) as { id: string; name: string }[];

  // Build zone name map for quick lookup
  const zoneMap = new Map(zones.map((z) => [z.id, z.name]));

  // Build query with server-side filters
  let query = supabase
    .from("zone_daily_payments")
    .select("id, zone_id, ref_command, amount, status, payment_method, paid_at, valid_until, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (params.zone) {
    query = query.eq("zone_id", params.zone);
  }
  if (params.status) {
    query = query.eq("status", params.status);
  }
  if (params.year && !params.from && !params.to) {
    query = query
      .gte("created_at", `${params.year}-01-01`)
      .lte("created_at", `${params.year}-12-31T23:59:59`);
  }
  if (params.from) {
    query = query.gte("created_at", `${params.from}T00:00:00`);
  }
  if (params.to) {
    query = query.lte("created_at", `${params.to}T23:59:59`);
  }

  const { data: paymentsRaw } = await query;
  let payments = (paymentsRaw || []) as any[];

  // Client-side search (zone name or ref_command)
  if (params.q) {
    const q = params.q.toLowerCase();
    payments = payments.filter(
      (p) =>
        (zoneMap.get(p.zone_id) || "").toLowerCase().includes(q) ||
        p.ref_command?.toLowerCase().includes(q)
    );
  }

  const nowIso = new Date().toISOString();

  // Compute summary stats from filtered results
  const totalCount = payments.length;
  const successCount = payments.filter((p) => p.status === "success").length;
  const pendingCount = payments.filter((p) => p.status === "pending").length;
  const totalRevenue = payments
    .filter((p) => p.status === "success")
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  // Current frais_plateforme (for pre-filling the manual activation modal)
  const todayStr = new Date().toISOString().split("T")[0];
  const { data: platformData } = await supabase
    .from("platform_settings")
    .select("frais_plateforme")
    .lte("effective_date", todayStr)
    .order("effective_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const currentFrais: number = platformData?.frais_plateforme ?? 5000;

  // Build available years from data (for filter buttons)
  const { data: yearsRaw } = await supabase
    .from("zone_daily_payments")
    .select("created_at")
    .order("created_at", { ascending: true })
    .limit(1);
  const { data: yearsRawLatest } = await supabase
    .from("zone_daily_payments")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(1);

  const firstYear = yearsRaw?.[0]?.created_at
    ? new Date(yearsRaw[0].created_at).getFullYear()
    : new Date().getFullYear();
  const lastYear = yearsRawLatest?.[0]?.created_at
    ? new Date(yearsRawLatest[0].created_at).getFullYear()
    : new Date().getFullYear();
  const years: number[] = [];
  for (let y = lastYear; y >= firstYear; y--) years.push(y);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
            <CreditCard className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading">Abonnements</h1>
            <p className="text-muted-foreground text-sm">Historique des activations billetterie par zone</p>
          </div>
        </div>
        <ManualActivationTrigger zones={zones} defaultAmount={currentFrais} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total paiements</p>
                <p className="text-2xl font-bold">{totalCount}</p>
              </div>
              <CreditCard className="h-7 w-7 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-700">Confirmés</p>
                <p className="text-2xl font-bold text-green-700">{successCount}</p>
              </div>
              <CheckCircle2 className="h-7 w-7 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-700">En attente</p>
                <p className="text-2xl font-bold text-amber-700">{pendingCount}</p>
              </div>
              <Clock className="h-7 w-7 text-amber-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-brand/20 bg-brand/5">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-brand">Total revenus</p>
                <p className="text-xl font-bold text-brand">{formatFCFA(totalRevenue)}</p>
              </div>
              <TrendingUp className="h-7 w-7 text-brand/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <BillingFilters zones={zones} years={years} />
        </CardContent>
      </Card>

      {/* Results table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-brand" />
            Historique des paiements
            <span className="text-sm font-normal text-muted-foreground ml-1">
              — {totalCount} résultat{totalCount !== 1 ? "s" : ""}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {payments.length === 0 ? (
            <div className="text-center py-14 text-muted-foreground">
              <XCircle className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="font-medium">Aucun paiement trouvé</p>
              <p className="text-sm mt-1">Essayez de modifier vos filtres</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead className="hidden md:table-cell">Référence</TableHead>
                    <TableHead className="hidden sm:table-cell">Moyen</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead className="hidden lg:table-cell">Valable jusqu&apos;à</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => {
                    const isActive =
                      p.status === "success" &&
                      p.valid_until &&
                      p.valid_until > nowIso;
                    return (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatDT(p.paid_at || p.created_at)}
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {zoneMap.get(p.zone_id) || "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground font-mono">
                        {p.ref_command}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {p.payment_method ? (METHOD_LABELS[p.payment_method] || p.payment_method) : "—"}
                      </TableCell>
                      <TableCell className="font-semibold whitespace-nowrap">
                        {formatFCFA(p.amount)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground whitespace-nowrap">
                        {p.status === "success" ? formatUntil(p.valid_until) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={STATUS_COLORS[p.status] || "bg-gray-100 text-gray-700"}
                        >
                          {STATUS_LABELS[p.status] || p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {isActive && (
                          <DeactivateButton
                            paymentId={p.id}
                            zoneName={zoneMap.get(p.zone_id) || "cette zone"}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

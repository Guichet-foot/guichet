import { requireRole } from "@/lib/auth";
import { checkZonePayment, getZonePaymentHistory } from "@/lib/actions/payment-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, Clock, CreditCard, ShoppingCart } from "lucide-react";
import { ActivateButton } from "./activate-button";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Abonnements" };

function formatFCFA(n: number) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FCFA";
}

function formatDT(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) +
    " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatUntil(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) +
    " le " + d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long" });
}

const METHOD_LABELS: Record<string, string> = {
  wave_senegal: "Wave",
  orange_money_senegal: "Orange Money",
  free_money: "Free Money",
  card: "Carte bancaire",
};

const STATUS_COLORS: Record<string, string> = {
  success: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-800",
};

const STATUS_LABELS: Record<string, string> = {
  success: "Confirmé",
  pending: "En attente",
  failed: "Échoué",
};

export default async function AbonnementsPage() {
  const profile = await requireRole(["super_admin", "admin_zone"]);

  if (profile.role === "super_admin") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold font-heading">Abonnements</h1>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Le compte Super Admin n&apos;est pas soumis aux frais journaliers.</p>
            <p className="text-sm mt-1">Les paiements sont effectués par les administrateurs de zone.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [payStatus, history] = await Promise.all([
    checkZonePayment(),
    getZonePaymentHistory(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-heading">Abonnements</h1>

      {/* Statut du jour */}
      <Card className={payStatus.isPaid ? "border-green-300 bg-green-50" : "border-amber-300 bg-amber-50"}>
        <CardContent className="pt-6 pb-6">
          {payStatus.isPaid ? (
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-green-800 text-lg">Billetterie ouverte</p>
                <p className="text-green-700 text-sm mt-0.5">
                  Zone <strong>{payStatus.zoneName}</strong> activée pour aujourd&apos;hui
                </p>
                {payStatus.validUntil && (
                  <div className="flex items-center gap-1.5 mt-2 text-sm text-green-700">
                    <Clock className="h-4 w-4" />
                    <span>Expire à {formatUntil(payStatus.validUntil)}</span>
                  </div>
                )}
                <div className="flex gap-2 mt-4">
                  <Link href="/vente">
                    <Button size="sm" className="bg-green-700 hover:bg-green-800">
                      <ShoppingCart className="h-4 w-4 mr-1" />
                      Ouvrir la caisse
                    </Button>
                  </Link>
                  <Link href="/scanner">
                    <Button size="sm" variant="outline" className="border-green-400 text-green-800">
                      Aller au scanner
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <CreditCard className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <p className="font-bold text-amber-900 text-lg">Billetterie non activée</p>
                  <p className="text-amber-700 text-sm">Zone {payStatus.zoneName} · Paiement requis pour aujourd&apos;hui</p>
                </div>
              </div>
              <ActivateButton amount={payStatus.amount} zoneName={payStatus.zoneName} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historique des paiements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-brand" />
            Historique des activations
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {history.items.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Aucun paiement enregistré</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="hidden sm:table-cell">Moyen</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead className="hidden md:table-cell">Valable jusqu&apos;à</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-sm">{formatDT(item.paidAt || item.createdAt)}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {item.paymentMethod ? (METHOD_LABELS[item.paymentMethod] || item.paymentMethod) : "—"}
                      </TableCell>
                      <TableCell className="font-semibold">{formatFCFA(item.amount)}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {item.status === "success" ? formatUntil(item.validUntil) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={STATUS_COLORS[item.status] || ""}>
                          {STATUS_LABELS[item.status] || item.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

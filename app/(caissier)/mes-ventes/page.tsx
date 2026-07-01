import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShoppingCart } from "lucide-react";
import { formatFCFA, formatDateTime } from "@/lib/format";
import { TICKET_STATUS_LABELS } from "@/lib/constants";
import { PrintButton } from "./print-button";

export const metadata = { title: "Mes ventes" };

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function MesVentesPage() {
  const profile = await requireAuth();
  const supabase = await createClient();

  const { data: tickets } = await supabase
    .from("tickets")
    .select("id, price, sold_at, status, sale_batch_id, match:matches(home_team, away_team), category:ticket_categories(name)")
    .eq("sold_by", profile.id)
    .order("sold_at", { ascending: false })
    .limit(500);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayTickets =
    tickets?.filter((t) => new Date(t.sold_at) >= todayStart && t.status !== "annule") || [];
  const todayTotal = todayTickets.reduce((sum, t) => sum + t.price, 0);

  // Grouper par sale_batch_id. Les anciens billets (sans batch_id) → chacun est sa propre ligne
  const batchMap = new Map<string, {
    batchId: string | null;
    ticketId: string;
    quantity: number;
    totalPrice: number;
    match: any;
    category: any;
    sold_at: string;
    status: string;
  }>();

  (tickets || []).forEach((ticket: any) => {
    const key = ticket.sale_batch_id || ticket.id;
    if (!batchMap.has(key)) {
      batchMap.set(key, {
        batchId: ticket.sale_batch_id,
        ticketId: ticket.id,
        quantity: 1,
        totalPrice: ticket.price,
        match: ticket.match,
        category: ticket.category,
        sold_at: ticket.sold_at,
        status: ticket.status,
      });
    } else {
      const existing = batchMap.get(key)!;
      existing.quantity++;
      existing.totalPrice += ticket.price;
      // Statut du lot = pire statut (annule > vendu > scanne)
      if (ticket.status === "annule") existing.status = "annule";
      else if (ticket.status === "vendu" && existing.status === "scanne") existing.status = "vendu";
    }
  });

  const batchedSales = Array.from(batchMap.values());

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold font-heading">Mes ventes</h1>

      <Card className="bg-brand/5 border-brand/20">
        <CardContent className="pt-4 pb-4">
          <p className="text-sm text-muted-foreground">Aujourd&apos;hui</p>
          <p className="text-lg font-bold">
            {todayTickets.length} billet(s) / {formatFCFA(todayTotal)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {batchedSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mb-4" />
              <p>Aucune vente</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Match</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead className="text-center">Nbre</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batchedSales.map((sale) => (
                  <TableRow key={sale.batchId || sale.ticketId}>
                    <TableCell className="text-sm">
                      {sale.match?.home_team} vs {sale.match?.away_team}
                    </TableCell>
                    <TableCell>{sale.category?.name}</TableCell>
                    <TableCell className="text-center">
                      {sale.quantity > 1 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand text-white text-xs font-bold">
                          {sale.quantity}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">1</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatFCFA(sale.totalPrice)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {formatDateTime(sale.sold_at)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          sale.status === "vendu"
                            ? "bg-blue-100 text-blue-800"
                            : sale.status === "scanne"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                        }
                      >
                        {TICKET_STATUS_LABELS[sale.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <PrintButton
                        ticketId={sale.ticketId}
                        batchId={sale.batchId}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

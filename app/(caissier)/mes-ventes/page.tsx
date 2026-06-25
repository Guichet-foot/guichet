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

export default async function MesVentesPage() {
  const profile = await requireAuth();
  const supabase = await createClient();

  const { data: tickets } = await supabase
    .from("tickets")
    .select(
      "*, match:matches(home_team, away_team), category:ticket_categories(name)"
    )
    .eq("sold_by", profile.id)
    .order("sold_at", { ascending: false })
    .limit(100);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayTickets =
    tickets?.filter((t) => new Date(t.sold_at) >= todayStart && t.status !== "annule") || [];
  const todayTotal = todayTickets.reduce((sum, t) => sum + t.price, 0);

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold font-heading">Mes ventes</h1>

      <Card className="bg-brand/5 border-brand/20">
        <CardContent className="pt-4 pb-4">
          <p className="text-sm text-muted-foreground">
            Aujourd&apos;hui
          </p>
          <p className="text-lg font-bold">
            {todayTickets.length} billets / {formatFCFA(todayTotal)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {!tickets || tickets.length === 0 ? (
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
                  <TableHead className="text-right">Prix</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="text-sm">
                      {ticket.match?.home_team} vs {ticket.match?.away_team}
                    </TableCell>
                    <TableCell>{ticket.category?.name}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatFCFA(ticket.price)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {formatDateTime(ticket.sold_at)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          ticket.status === "vendu"
                            ? "bg-blue-100 text-blue-800"
                            : ticket.status === "scanne"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                        }
                      >
                        {TICKET_STATUS_LABELS[ticket.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <PrintButton ticketId={ticket.id} />
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

import { requireRole } from "@/lib/auth";
import { getBilleterieList } from "@/lib/actions/billeterie-actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Ticket, Plus } from "lucide-react";
import Link from "next/link";
import { formatFCFA } from "@/lib/format";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export const metadata = { title: "Billetterie — Fondateur" };

export default async function FondateurBilletteriePage() {
  await requireRole(["fondateur"]);
  const items = await getBilleterieList();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Billetterie</h1>
          <p className="text-muted-foreground">{items.length} pass multi-matchs créé{items.length !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/fondateur/billeterie/nouveau">
          <Button className="bg-brand hover:bg-brand/90">
            <Plus className="h-4 w-4 mr-2" />
            Nouveau pass
          </Button>
        </Link>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Ticket className="h-12 w-12 mb-4" />
            <p className="font-medium mb-1">Aucun pass créé</p>
            <p className="text-sm">Créez un pass multi-matchs pour regrouper plusieurs matchs sur un seul billet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Link key={item.id} href={`/fondateur/billeterie/${item.id}`}>
              <Card className="hover:border-brand/40 transition-colors cursor-pointer h-full">
                <CardContent className="pt-5 pb-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-base leading-tight">{item.name}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {format(new Date(item.createdAt), "d MMM yyyy", { locale: fr })}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {item.matchIds.length} match{item.matchIds.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-border">
                    <span className="text-sm font-semibold text-brand">{formatFCFA(item.price)}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.totalTickets} billet{item.totalTickets !== 1 ? "s" : ""}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

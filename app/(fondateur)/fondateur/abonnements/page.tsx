import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, MapPin } from "lucide-react";
import { SubscriptionManager } from "./subscription-manager";

export const metadata = { title: "Abonnements" };

/* eslint-disable @typescript-eslint/no-explicit-any */

const SUBSCRIPTION_LABELS: Record<string, string> = {
  mensuel: "Mensuel",
  "15_jours": "15 jours",
  annuel: "Annuel",
};

export default async function AbonnementsPage() {
  await requireRole(["fondateur"]);
  const supabase = await createAdminClient();

  const { data: zones } = await supabase
    .from("zones")
    .select("id, name, region, created_by, subscription_type, subscription_start, subscription_end, subscription_active, profiles:profiles!zones_created_by_fkey(full_name)")
    .order("name") as { data: any[] | null };

  const activeCount = zones?.filter((z: any) => z.subscription_active).length || 0;
  const expiredCount = zones?.filter((z: any) => {
    if (!z.subscription_end) return false;
    return new Date(z.subscription_end) < new Date();
  }).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
          <CreditCard className="h-6 w-6 text-amber-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading">Abonnements</h1>
          <p className="text-muted-foreground text-sm">Gérez les abonnements des zones</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-xs text-muted-foreground">Total zones</p>
            <p className="text-2xl font-bold">{zones?.length || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-green-200">
          <CardContent className="pt-6 text-center">
            <p className="text-xs text-muted-foreground">Actifs</p>
            <p className="text-2xl font-bold text-green-600">{activeCount}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200">
          <CardContent className="pt-6 text-center">
            <p className="text-xs text-muted-foreground">Expirés</p>
            <p className="text-2xl font-bold text-red-600">{expiredCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {!zones || zones.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-4" />
              <p>Aucune zone</p>
            </CardContent>
          </Card>
        ) : (
          zones.map((zone: any) => {
            const isExpired = zone.subscription_end && new Date(zone.subscription_end) < new Date();
            const saName = zone.profiles?.full_name || "—";

            return (
              <Card key={zone.id} className={!zone.subscription_active ? "opacity-60" : ""}>
                <CardContent className="pt-5 pb-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
                        <MapPin className="h-5 w-5 text-brand" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{zone.name}</h3>
                        <p className="text-xs text-muted-foreground">{zone.region || "—"} · SA: {saName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {zone.subscription_type ? (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                          {SUBSCRIPTION_LABELS[zone.subscription_type] || zone.subscription_type}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-gray-100 text-gray-600">Aucun</Badge>
                      )}
                      {zone.subscription_active ? (
                        isExpired ? (
                          <Badge variant="secondary" className="bg-red-100 text-red-800">Expiré</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">Actif</Badge>
                        )
                      ) : (
                        <Badge variant="secondary" className="bg-red-100 text-red-800">Bloqué</Badge>
                      )}
                      {zone.subscription_end && (
                        <span className="text-xs text-muted-foreground">
                          Fin : {new Date(zone.subscription_end).toLocaleDateString("fr-FR")}
                        </span>
                      )}
                      <SubscriptionManager
                        zoneId={zone.id}
                        zoneName={zone.name}
                        currentType={zone.subscription_type || ""}
                        currentStart={zone.subscription_start || ""}
                        currentEnd={zone.subscription_end || ""}
                        currentActive={zone.subscription_active ?? true}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

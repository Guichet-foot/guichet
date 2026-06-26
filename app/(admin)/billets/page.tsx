import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveZone } from "@/lib/get-effective-zone";
import { Card, CardContent } from "@/components/ui/card";
import { Ticket } from "lucide-react";
import { formatFCFA } from "@/lib/format";
import { ZoneCardGrid } from "@/components/zone-card-grid";
import { ZoneBackHeader } from "@/components/zone-back-header";
import { TicketTemplateForm } from "./ticket-template-form";
import { TicketTemplateActions } from "./ticket-template-actions";
import { TicketPreview } from "./ticket-preview";

export const metadata = { title: "Billets" };

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function BilletsPage({
  searchParams,
}: {
  searchParams: Promise<{ zone?: string }>;
}) {
  const profile = await requireRole(["super_admin", "admin_zone"]);
  const params = await searchParams;
  const { effectiveZoneId, selectedZone, ownedZones, needsZoneSelection } =
    await getEffectiveZone(profile, params.zone);

  if (needsZoneSelection) {
    return <ZoneCardGrid zones={ownedZones} title="Billets" />;
  }

  const supabase = await createClient();

  const { data: templates } = await supabase
    .from("ticket_templates")
    .select("*")
    .eq("zone_id", effectiveZoneId!)
    .order("price", { ascending: true });

  return (
    <div className="space-y-6">
      {profile.role === "super_admin" && selectedZone && <ZoneBackHeader zoneName={selectedZone.name} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Billets</h1>
          <p className="text-muted-foreground">
            Modèles de billets réutilisables pour chaque match
          </p>
        </div>
        <TicketTemplateForm zoneId={effectiveZoneId!} />
      </div>

      {!templates || templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Ticket className="h-12 w-12 mx-auto mb-4" />
            <p>Aucun modèle de billet créé</p>
            <p className="text-sm mt-1">
              Créez des modèles (Tribune, Pelouse, VIP...) pour les réutiliser sur chaque match
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t: any) => (
            <Card key={t.id} className="overflow-hidden">
              <div className="h-2" style={{ backgroundColor: t.color || "#0D5C3F" }} />
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-lg">{t.name}</h3>
                    <p className="text-2xl font-bold text-brand">{formatFCFA(t.price)}</p>
                    <p className="text-sm text-muted-foreground">
                      Quantité par défaut : {t.default_quantity}
                    </p>
                  </div>
                  <TicketTemplateActions
                    template={t}
                    zoneId={effectiveZoneId!}
                  />
                </div>

                <TicketPreview
                  name={t.name}
                  price={t.price}
                  color={t.color || "#0D5C3F"}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

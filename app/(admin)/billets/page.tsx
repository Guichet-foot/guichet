import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveZone } from "@/lib/get-effective-zone";
import { Card, CardContent } from "@/components/ui/card";
import { Ticket } from "lucide-react";
import { ZoneCardGrid } from "@/components/zone-card-grid";
import { ZoneBackHeader } from "@/components/zone-back-header";
import { TicketTemplateForm } from "./ticket-template-form";
import { TicketTemplateActions } from "./ticket-template-actions";

export const metadata = { title: "Catégories de billets" };

/* eslint-disable @typescript-eslint/no-explicit-any */

function formatPrice(amount: number) {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FCFA";
}

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default async function BilletsPage({
  searchParams,
}: {
  searchParams: Promise<{ zone?: string }>;
}) {
  const profile = await requireRole(["super_admin", "admin_zone", "c3"]);
  const params = await searchParams;
  const { effectiveZoneId, selectedZone, ownedZones, needsZoneSelection, c3AccountId } =
    await getEffectiveZone(profile, params.zone);

  if (needsZoneSelection) {
    return <ZoneCardGrid zones={ownedZones} title="Catégories de billets" />;
  }

  const supabase = await createClient();

  // C3: filter by c3_account_id; zone-based: filter by zone_id
  const templatesQuery = supabase
    .from("ticket_templates")
    .select("*")
    .order("price", { ascending: true });

  const { data: templates } = c3AccountId
    ? await templatesQuery.eq("c3_account_id", c3AccountId)
    : await templatesQuery.eq("zone_id", effectiveZoneId!);

  return (
    <div className="space-y-6">
      {profile.role === "super_admin" && selectedZone && <ZoneBackHeader zoneName={selectedZone.name} />}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
            <Ticket className="h-6 w-6 text-brand" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading">Catégories de billets</h1>
            <p className="text-muted-foreground text-sm">
              Gérez les catégories et les tarifs des billets pour vos matchs
            </p>
          </div>
        </div>
        <TicketTemplateForm zoneId={c3AccountId ? null : effectiveZoneId!} c3AccountId={c3AccountId} />
      </div>

      {!templates || templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Ticket className="h-12 w-12 mx-auto mb-4" />
            <p>Aucune catégorie de billet créée</p>
            <p className="text-sm mt-1">
              Créez des catégories (Tribune, Pelouse, VIP...) pour les réutiliser sur chaque match
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {templates.map((t: any) => {
            const color = t.color || "#0D5C3F";
            const bgLight = hexToRgba(color, 0.06);
            const iconBg = hexToRgba(color, 0.12);

            return (
              <Card key={t.id} className="overflow-hidden border-t-4" style={{ borderTopColor: color }}>
                {/* Header with icon + name */}
                <div className="px-5 pt-5 pb-3" style={{ backgroundColor: bgLight }}>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: iconBg }}
                    >
                      <Ticket className="h-6 w-6" style={{ color }} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{t.name}</h3>
                      {t.description && (
                        <p className="text-sm text-muted-foreground">{t.description}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Price section */}
                <CardContent className="pt-4 pb-4 space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Prix</p>
                    <p className="text-2xl font-bold" style={{ color }}>
                      {formatPrice(t.price)}
                    </p>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-end pt-2 border-t border-border/50">
                    <TicketTemplateActions
                      template={t}
                      zoneId={effectiveZoneId!}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

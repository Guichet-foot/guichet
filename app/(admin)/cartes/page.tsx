import { requireRole } from "@/lib/auth";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getEffectiveZone } from "@/lib/get-effective-zone";
import { getAccessCards } from "@/lib/actions/carte-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard, Plus, User, QrCode } from "lucide-react";
import Link from "next/link";
import type { AccessCard } from "@/lib/types";

export const metadata = { title: "Cartes d'accès" };

/* eslint-disable @typescript-eslint/no-explicit-any */

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export default async function CartesPage({
  searchParams,
}: {
  searchParams: Promise<{ zone?: string }>;
}) {
  const profile = await requireRole(["super_admin", "admin_zone"]);
  const params = await searchParams;

  const supabase = await createClient();
  const adminClient = await createAdminClient();

  const isSuperAdmin = profile.role === "super_admin";

  // For super_admin: load all zones + allow filter
  const { data: zonesRaw } = isSuperAdmin
    ? await adminClient.from("zones").select("id, name").order("name")
    : { data: null };
  const zones = (zonesRaw || []) as { id: string; name: string }[];

  // Get effective zone
  let filterZoneId: string | undefined;
  if (isSuperAdmin) {
    filterZoneId = params.zone || undefined;
  } else {
    // admin_zone: only their zone
    const { data: prof } = await supabase
      .from("profiles")
      .select("zone_id")
      .eq("id", profile.id)
      .single();
    filterZoneId = prof?.zone_id ?? undefined;
  }

  const cards = await getAccessCards(filterZoneId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
            <CreditCard className="h-6 w-6 text-green-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading">Cartes d&apos;accès</h1>
            <p className="text-muted-foreground text-sm">
              {cards.length} carte{cards.length !== 1 ? "s" : ""} créée{cards.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Link href="/cartes/nouveau">
          <Button className="bg-green-700 hover:bg-green-800 text-white">
            <Plus className="h-4 w-4 mr-2" />
            Créer une carte
          </Button>
        </Link>
      </div>

      {/* Zone filter for super_admin */}
      {isSuperAdmin && zones.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <Link href="/cartes">
            <Badge
              variant={!filterZoneId ? "default" : "secondary"}
              className="cursor-pointer px-3 py-1"
            >
              Toutes les zones
            </Badge>
          </Link>
          {zones.map((z) => (
            <Link key={z.id} href={`/cartes?zone=${z.id}`}>
              <Badge
                variant={filterZoneId === z.id ? "default" : "secondary"}
                className="cursor-pointer px-3 py-1"
              >
                {z.name}
              </Badge>
            </Link>
          ))}
        </div>
      )}

      {/* Cards grid */}
      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <CreditCard className="h-16 w-16 mb-4 opacity-20" />
          <p className="font-medium">Aucune carte créée</p>
          <p className="text-sm mt-1">Créez votre première carte d&apos;accès</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card: AccessCard) => (
            <Link key={card.id} href={`/cartes/${card.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer border-green-100 hover:border-green-300">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    {/* Photo or avatar */}
                    <div className="w-12 h-12 rounded-full border-2 border-green-700 overflow-hidden shrink-0 bg-green-50">
                      {card.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={card.photo_url}
                          alt={card.full_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="h-6 w-6 text-green-700" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{card.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{card.poste}</p>
                      <p className="text-xs text-green-700 truncate">{card.zone_name}</p>
                      {card.asc_name && (
                        <p className="text-xs text-muted-foreground truncate">{card.asc_name}</p>
                      )}
                    </div>
                    <QrCode className="h-4 w-4 text-muted-foreground/40 shrink-0 ml-auto" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Créée le {formatDate(card.created_at)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

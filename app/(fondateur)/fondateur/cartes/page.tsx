import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { getAllOdcavCards } from "@/lib/actions/carte-actions";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, IdCard, Shield, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import QRCode from "qrcode";
import { CartesClient } from "@/app/(admin)/cartes/cartes-grid";
import type { AccessCard } from "@/lib/types";

export const metadata = { title: "Cartes d'accès — Fondateur" };

export default async function FondateurCartesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  await requireRole(["fondateur"]);
  const params = await searchParams;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://guichet-pi.vercel.app";

  // ── Onglet ODCAV ────────────────────────────────────────────────────────────
  if (params.view === "odcav") {
    const odcavCards = await getAllOdcavCards();
    const items = await Promise.all(
      odcavCards.map(async (card: AccessCard) => {
        const qrDataUrl = await QRCode.toDataURL(`${appUrl}/carte/${card.qr_token}`, {
          width: 200, margin: 2, errorCorrectionLevel: "M",
          color: { dark: "#000000", light: "#ffffff" },
        });
        return { card, qrDataUrl };
      })
    );

    return (
      <div className="space-y-6">
        <OdcavTabBar active="odcav" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
              <Shield className="h-6 w-6 text-purple-700" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-heading">Cartes ODCAV</h2>
              <p className="text-muted-foreground text-sm">
                {items.length} carte{items.length !== 1 ? "s" : ""} créée{items.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <Link href="/fondateur/cartes/odcav/nouveau">
            <Button className="bg-purple-700 hover:bg-purple-800 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Créer une carte ODCAV
            </Button>
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <Shield className="h-16 w-16 mb-4 opacity-20" />
            <p className="font-medium">Aucune carte ODCAV créée</p>
            <p className="text-sm mt-1">Créez la première carte pour un membre de l&apos;ODCAV</p>
          </div>
        ) : (
          <CartesClient items={items} zoneLogo={undefined} readOnly={false} odcavOnly />
        )}
      </div>
    );
  }

  // ── Vue sélection de zones ──────────────────────────────────────────────────
  const adminClient = await createAdminClient();
  const { data: zones } = await adminClient
    .from("zones")
    .select("id, name, region, president, logo")
    .order("name");

  const zoneList = (zones || []) as {
    id: string; name: string; region: string | null;
    president: string | null; logo: string | null;
  }[];

  return (
    <div className="space-y-6">
      <OdcavTabBar active="zones" />

      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
          <IdCard className="h-6 w-6 text-green-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading">Cartes d&apos;accès</h1>
          <p className="text-muted-foreground text-sm">Sélectionnez une zone</p>
        </div>
      </div>

      {zoneList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <MapPin className="h-16 w-16 mb-4 opacity-30" />
          <p className="text-lg">Aucune zone</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {zoneList.map((zone) => (
            <Link key={zone.id} href={`/fondateur/cartes/${zone.id}`}>
              <Card className="cursor-pointer hover:border-green-500/50 hover:shadow-md transition-all">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    {zone.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={zone.logo} alt={zone.name} className="w-12 h-12 rounded-lg object-cover border" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                        <MapPin className="h-6 w-6 text-green-700" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="font-semibold text-lg truncate">{zone.name}</h3>
                      {zone.region && <p className="text-sm text-muted-foreground">{zone.region}</p>}
                      {zone.president && (
                        <p className="text-xs text-muted-foreground mt-1">Président : {zone.president}</p>
                      )}
                    </div>
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

function OdcavTabBar({ active }: { active: "zones" | "odcav" }) {
  return (
    <div className="border-b border-border flex">
      <Link
        href="/fondateur/cartes"
        className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
          active === "zones"
            ? "border-green-700 text-green-700"
            : "border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        <IdCard className="h-4 w-4 inline mr-1.5 -mt-0.5" />
        Cartes de zones
      </Link>
      <Link
        href="/fondateur/cartes?view=odcav"
        className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
          active === "odcav"
            ? "border-purple-700 text-purple-700"
            : "border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        <Shield className="h-4 w-4 inline mr-1.5 -mt-0.5" />
        Cartes ODCAV
      </Link>
    </div>
  );
}

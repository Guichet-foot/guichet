import { requireRole } from "@/lib/auth";
import { getEffectiveZone } from "@/lib/get-effective-zone";
import { getAccessCards } from "@/lib/actions/carte-actions";
import { Button } from "@/components/ui/button";
import { CreditCard, Plus } from "lucide-react";
import Link from "next/link";
import QRCode from "qrcode";
import { CartesClient } from "./cartes-grid";
import { ZoneCardGrid } from "@/components/zone-card-grid";
import { ZoneBackHeader } from "@/components/zone-back-header";

export const metadata = { title: "Cartes d'accès" };

export default async function CartesPage({
  searchParams,
}: {
  searchParams: Promise<{ zone?: string }>;
}) {
  const profile = await requireRole(["super_admin", "admin_zone"]);
  const params = await searchParams;

  const { effectiveZoneId, selectedZone, ownedZones, needsZoneSelection } =
    await getEffectiveZone(profile, params.zone);

  // ODCAV (super_admin / president_odcav) sans zone sélectionnée → grille de zones
  if (needsZoneSelection) {
    return <ZoneCardGrid zones={ownedZones} title="Cartes d'accès" />;
  }

  const cards = await getAccessCards(effectiveZoneId ?? undefined);

  // Generate QR codes server-side
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://guichet-pi.vercel.app";
  const items = await Promise.all(
    cards.map(async (card) => {
      const qrDataUrl = await QRCode.toDataURL(`${appUrl}/carte/${card.qr_token}`, {
        width: 200, margin: 2, errorCorrectionLevel: "M",
        color: { dark: "#000000", light: "#ffffff" },
      });
      return { card, qrDataUrl };
    })
  );

  const isOdcavRole = profile.role === "super_admin" || profile.role === "president_odcav" || profile.role === "tresorier";
  const isReadOnly = profile.role === "tresorier";

  // Build the "Créer une carte" link — pass zone param for ODCAV roles so the form pre-selects it
  const createHref = isOdcavRole && effectiveZoneId
    ? `/cartes/nouveau?zone=${effectiveZoneId}`
    : "/cartes/nouveau";

  return (
    <div className="space-y-6">
      {/* Back header for ODCAV navigating into a specific zone */}
      {isOdcavRole && selectedZone && (
        <ZoneBackHeader zoneName={selectedZone.name} />
      )}

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
        {!isReadOnly && (
          <Link href={createHref}>
            <Button className="bg-green-700 hover:bg-green-800 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Créer une carte
            </Button>
          </Link>
        )}
      </div>

      {/* Client: stats + tabs + grid */}
      <CartesClient items={items} zoneLogo={selectedZone?.logo ?? undefined} readOnly={isReadOnly} />
    </div>
  );
}

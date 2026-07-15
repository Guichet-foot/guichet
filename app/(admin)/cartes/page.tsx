import { requireRole } from "@/lib/auth";
import { getEffectiveZone } from "@/lib/get-effective-zone";
import { getAccessCards, getOdcavCards } from "@/lib/actions/carte-actions";
import { Button } from "@/components/ui/button";
import { CreditCard, Plus, Shield } from "lucide-react";
import Link from "next/link";
import QRCode from "qrcode";
import { CartesClient } from "./cartes-grid";
import { ZoneCardGrid } from "@/components/zone-card-grid";
import { ZoneBackHeader } from "@/components/zone-back-header";

export const metadata = { title: "Cartes d'accès" };

export default async function CartesPage({
  searchParams,
}: {
  searchParams: Promise<{ zone?: string; view?: string }>;
}) {
  const profile = await requireRole(["super_admin", "admin_zone"]);
  const params = await searchParams;

  const { effectiveZoneId, selectedZone, ownedZones, needsZoneSelection } =
    await getEffectiveZone(profile, params.zone);

  const isOdcavRole = profile.role === "super_admin" || profile.role === "president_odcav";
  const isReadOnly = profile.role === "tresorier";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://guichet-pi.vercel.app";

  // ── Onglet ODCAV (super_admin sans zone sélectionnée) ──────────────────────
  if (isOdcavRole && needsZoneSelection && params.view === "odcav") {
    const odcavCards = await getOdcavCards();
    const items = await Promise.all(
      odcavCards.map(async (card) => {
        const qrDataUrl = await QRCode.toDataURL(`${appUrl}/carte/${card.qr_token}`, {
          width: 200, margin: 2, errorCorrectionLevel: "M",
          color: { dark: "#000000", light: "#ffffff" },
        });
        return { card, qrDataUrl };
      })
    );

    return (
      <div className="space-y-6">
        {/* Tab bar */}
        <OdcavTabBar active="odcav" />

        {/* Header ODCAV */}
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
          <Link href="/cartes/odcav/nouveau">
            <Button className="bg-purple-700 hover:bg-purple-800 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Créer une carte ODCAV
            </Button>
          </Link>
        </div>

        {/* Grid */}
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <Shield className="h-16 w-16 mb-4 opacity-20" />
            <p className="font-medium">Aucune carte ODCAV créée</p>
            <p className="text-sm mt-1">Créez la première carte pour un membre de l&apos;ODCAV</p>
          </div>
        ) : (
          <CartesClient items={items} zoneLogo={undefined} readOnly={isReadOnly} odcavOnly />
        )}
      </div>
    );
  }

  // ── Vue sélection de zones (super_admin sans zone) ──────────────────────────
  if (needsZoneSelection) {
    return (
      <div className="space-y-6">
        {isOdcavRole && <OdcavTabBar active="zones" />}
        <ZoneCardGrid zones={ownedZones} title="Cartes d'accès" />
      </div>
    );
  }

  // ── Vue zone spécifique ─────────────────────────────────────────────────────
  const cards = await getAccessCards(effectiveZoneId ?? undefined);

  const items = await Promise.all(
    cards.map(async (card) => {
      const qrDataUrl = await QRCode.toDataURL(`${appUrl}/carte/${card.qr_token}`, {
        width: 200, margin: 2, errorCorrectionLevel: "M",
        color: { dark: "#000000", light: "#ffffff" },
      });
      return { card, qrDataUrl };
    })
  );

  const createHref = isOdcavRole && effectiveZoneId
    ? `/cartes/nouveau?zone=${effectiveZoneId}`
    : "/cartes/nouveau";

  return (
    <div className="space-y-6">
      {isOdcavRole && selectedZone && (
        <ZoneBackHeader zoneName={selectedZone.name} />
      )}

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

      <CartesClient items={items} zoneLogo={selectedZone?.logo ?? undefined} readOnly={isReadOnly} />
    </div>
  );
}

/** Barre d'onglets super_admin : Zones | ODCAV */
function OdcavTabBar({ active }: { active: "zones" | "odcav" }) {
  return (
    <div className="border-b border-border flex">
      <Link
        href="/cartes"
        className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
          active === "zones"
            ? "border-green-700 text-green-700"
            : "border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        <CreditCard className="h-4 w-4 inline mr-1.5 -mt-0.5" />
        Cartes de zones
      </Link>
      <Link
        href="/cartes?view=odcav"
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

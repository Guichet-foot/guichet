import { requireRole } from "@/lib/auth";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getAccessCards } from "@/lib/actions/carte-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard, Plus, User } from "lucide-react";
import Link from "next/link";
import type { AccessCard } from "@/lib/types";
import QRCode from "qrcode";

export const metadata = { title: "Cartes d'accès" };

/* eslint-disable @typescript-eslint/no-explicit-any */

function getSaison(card: AccessCard): string {
  if (card.saison) return card.saison;
  const d = new Date(card.created_at);
  const y = d.getFullYear();
  return d.getMonth() + 1 >= 8 ? `${y} - ${y + 1}` : `${y - 1} - ${y}`;
}

/** Mini card preview — same design as the full card, scales via cqi */
function CardPreview({ card, qrDataUrl }: { card: AccessCard; qrDataUrl: string }) {
  const saison = getSaison(card);
  const rows = [
    card.full_name,
    card.phone,
    card.zone_name,
    card.poste,
    ...(card.asc_name ? [card.asc_name] : []),
  ];
  const numRows = rows.length;

  return (
    <div style={{ containerType: "inline-size" }}>
      <div
        className="relative w-full border-[2.5px] border-green-800 rounded-xl overflow-hidden bg-white shadow-md"
        style={{ aspectRatio: "85.6 / 54" }}
      >
        {/* Header */}
        <div
          className="absolute inset-x-0 top-0 flex items-center bg-green-50 border-b border-green-800"
          style={{ height: "27.8%", padding: "1.5% 2%" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logoodcavdes.png"
            alt="ODCAV"
            style={{ height: "85%", width: "auto", objectFit: "contain", flexShrink: 0 }}
          />
          <div style={{ flex: 1, textAlign: "center", paddingRight: "27%" }}>
            <p
              className="font-black text-green-800 leading-tight"
              style={{ fontSize: "6cqi", lineHeight: 1.05 }}
            >
              CARTE D&apos;ACCÈS
            </p>
            <p
              className="font-semibold text-green-700"
              style={{ fontSize: "2.3cqi", marginTop: "0.4cqi" }}
            >
              — SAISON {saison} —
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="absolute inset-x-0 bottom-0 flex" style={{ top: "27.8%" }}>
          {/* Info rows */}
          <div className="flex flex-col border-r border-gray-200" style={{ width: "65%" }}>
            {rows.map((value, i) => (
              <div
                key={i}
                className="flex items-center"
                style={{
                  flex: 1,
                  borderBottom: i < numRows - 1 ? "0.5px solid #e5e7eb" : "none",
                  padding: "0 2%",
                  gap: "2%",
                }}
              >
                <div
                  className="rounded bg-green-800 shrink-0"
                  style={{ width: "5.5cqi", height: "5.5cqi" }}
                />
                <p
                  className="font-bold text-gray-900 truncate"
                  style={{ fontSize: "2.5cqi" }}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* QR */}
          <div
            className="flex items-end justify-center"
            style={{ width: "35%", paddingBottom: "2%" }}
          >
            <div className="border border-green-800" style={{ width: "70%", padding: "1%" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="QR"
                className="w-full block"
                style={{ imageRendering: "pixelated" } as React.CSSProperties}
              />
            </div>
          </div>
        </div>

        {/* Photo */}
        <div
          className="absolute rounded-full overflow-hidden bg-green-100"
          style={{
            width: "24%",
            aspectRatio: "1 / 1",
            top: "4%",
            right: "2%",
            border: "2.5px solid #1a5c2a",
          }}
        >
          {card.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.photo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-green-50">
              <User className="w-2/5 h-2/5 text-green-600" />
            </div>
          )}
        </div>
      </div>

      {/* Card name below preview */}
      <p className="text-xs font-semibold text-gray-700 mt-1.5 truncate">{card.full_name}</p>
      <p className="text-xs text-muted-foreground truncate">{card.poste} · {card.zone_name}</p>
    </div>
  );
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

  const { data: zonesRaw } = isSuperAdmin
    ? await adminClient.from("zones").select("id, name").order("name")
    : { data: null };
  const zones = (zonesRaw || []) as { id: string; name: string }[];

  let filterZoneId: string | undefined;
  if (isSuperAdmin) {
    filterZoneId = params.zone || undefined;
  } else {
    const { data: prof } = await supabase
      .from("profiles")
      .select("zone_id")
      .eq("id", profile.id)
      .single();
    filterZoneId = prof?.zone_id ?? undefined;
  }

  const cards = await getAccessCards(filterZoneId);

  // Generate QR codes server-side for all cards
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://guichet-pi.vercel.app";
  const cardsWithQR = await Promise.all(
    cards.map(async (card) => {
      const qrDataUrl = await QRCode.toDataURL(`${appUrl}/carte/${card.qr_token}`, {
        width: 200, margin: 2, errorCorrectionLevel: "M",
        color: { dark: "#000000", light: "#ffffff" },
      });
      return { card, qrDataUrl };
    })
  );

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

      {/* Zone filter */}
      {isSuperAdmin && zones.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <Link href="/cartes">
            <Badge variant={!filterZoneId ? "default" : "secondary"} className="cursor-pointer px-3 py-1">
              Toutes les zones
            </Badge>
          </Link>
          {zones.map((z) => (
            <Link key={z.id} href={`/cartes?zone=${z.id}`}>
              <Badge variant={filterZoneId === z.id ? "default" : "secondary"} className="cursor-pointer px-3 py-1">
                {z.name}
              </Badge>
            </Link>
          ))}
        </div>
      )}

      {/* Cards grid — 3 par ligne */}
      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <CreditCard className="h-16 w-16 mb-4 opacity-20" />
          <p className="font-medium">Aucune carte créée</p>
          <p className="text-sm mt-1">Créez votre première carte d&apos;accès</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {cardsWithQR.map(({ card, qrDataUrl }) => (
            <Link
              key={card.id}
              href={`/cartes/${card.id}`}
              className="block hover:opacity-90 transition-opacity"
            >
              <CardPreview card={card} qrDataUrl={qrDataUrl} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

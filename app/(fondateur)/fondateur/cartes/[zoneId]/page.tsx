import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";
import QRCode from "qrcode";
import { CartesClient } from "@/app/(admin)/cartes/cartes-grid";
import type { AccessCard } from "@/lib/types";

export const metadata = { title: "Cartes d'accès de zone — Fondateur" };

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function FondateurZoneCartesPage({
  params,
}: {
  params: Promise<{ zoneId: string }>;
}) {
  await requireRole(["fondateur"]);
  const { zoneId } = await params;
  const adminClient = await createAdminClient();

  const { data: zone } = await adminClient
    .from("zones")
    .select("id, name")
    .eq("id", zoneId)
    .single();

  if (!zone) notFound();

  const { data: cards } = await adminClient
    .from("access_cards")
    .select("*")
    .eq("zone_id", zoneId)
    .order("created_at", { ascending: false });

  const cardList = (cards || []) as AccessCard[];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://guichet-pi.vercel.app";
  const items = await Promise.all(
    cardList.map(async (card) => {
      const qrDataUrl = await QRCode.toDataURL(`${appUrl}/carte/${card.qr_token}`, {
        width: 200, margin: 2, errorCorrectionLevel: "M",
        color: { dark: "#000000", light: "#ffffff" },
      });
      return { card, qrDataUrl };
    })
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/fondateur/cartes">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Zones
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold font-heading">{zone.name}</h1>
            <p className="text-muted-foreground text-sm">
              {cardList.length} carte{cardList.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Link href={`/fondateur/cartes/${zoneId}/nouveau`}>
          <Button className="bg-green-700 hover:bg-green-800 text-white">
            <Plus className="h-4 w-4 mr-2" />
            Créer une carte
          </Button>
        </Link>
      </div>

      <CartesClient items={items} />
    </div>
  );
}

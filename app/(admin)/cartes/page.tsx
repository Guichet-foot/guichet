import { requireRole } from "@/lib/auth";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getAccessCards } from "@/lib/actions/carte-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard, Plus } from "lucide-react";
import Link from "next/link";
import QRCode from "qrcode";
import { CartesGrid } from "./cartes-grid";

export const metadata = { title: "Cartes d'accès" };

/* eslint-disable @typescript-eslint/no-explicit-any */

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

      {/* Grid */}
      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <CreditCard className="h-16 w-16 mb-4 opacity-20" />
          <p className="font-medium">Aucune carte créée</p>
          <p className="text-sm mt-1">Créez votre première carte d&apos;accès</p>
        </div>
      ) : (
        <CartesGrid items={items} />
      )}
    </div>
  );
}

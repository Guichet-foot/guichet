"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  User,
  Phone,
  MapPin,
  Briefcase,
  Shield,
  Printer,
  Pencil,
} from "lucide-react";
import type { AccessCard } from "@/lib/types";

export interface CardWithQR {
  card: AccessCard;
  qrDataUrl: string;
}

function getSaison(card: AccessCard): string {
  if (card.saison) return card.saison;
  const d = new Date(card.created_at);
  const y = d.getFullYear();
  return d.getMonth() + 1 >= 8 ? `${y} - ${y + 1}` : `${y - 1} - ${y}`;
}

const ICON_MAP = [User, Phone, MapPin, Briefcase, Shield];

/** Card design — scales via container queries (cqi). Used in grid and dialog. */
function CardDesign({ card, qrDataUrl }: { card: AccessCard; qrDataUrl: string }) {
  const saison = getSaison(card);
  const rows = [
    { Icon: User,      label: "NOM COMPLET", value: card.full_name },
    { Icon: Phone,     label: "TÉLÉPHONE",   value: card.phone },
    { Icon: MapPin,    label: "ZONE",        value: card.zone_name },
    { Icon: Briefcase, label: "POSTE",       value: card.poste },
    ...(card.asc_name ? [{ Icon: Shield, label: "ASC", value: card.asc_name }] : []),
  ];

  return (
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
          {rows.map(({ Icon, label, value }, i) => (
            <div
              key={label}
              className="flex items-center"
              style={{
                flex: 1,
                borderBottom: i < rows.length - 1 ? "0.5px solid #e5e7eb" : "none",
                padding: "0 2%",
                gap: "2%",
              }}
            >
              <div
                className="flex items-center justify-center rounded bg-green-800 shrink-0"
                style={{ width: "5.5cqi", height: "5.5cqi" }}
              >
                <Icon style={{ width: "58%", height: "58%", color: "white" }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p
                  className="font-bold text-green-800 uppercase leading-none"
                  style={{ fontSize: "1.6cqi", letterSpacing: "0.03em" }}
                >
                  {label}
                </p>
                <p
                  className="font-bold text-gray-900 truncate"
                  style={{ fontSize: "2.5cqi", marginTop: "0.2cqi" }}
                >
                  {value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* QR */}
        <div
          className="flex items-end justify-center bg-white"
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
        className="absolute rounded-full overflow-hidden bg-green-50"
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
          <div className="w-full h-full flex items-center justify-center">
            <User className="w-2/5 h-2/5 text-green-600" />
          </div>
        )}
      </div>
    </div>
  );
}

interface CartesGridProps {
  items: CardWithQR[];
}

export function CartesGrid({ items }: CartesGridProps) {
  const [selected, setSelected] = useState<CardWithQR | null>(null);

  return (
    <>
      {/* Grid 3 par ligne */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((item) => (
          <button
            key={item.card.id}
            className="text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-green-700 rounded-xl"
            style={{ containerType: "inline-size" }}
            onClick={() => setSelected(item)}
          >
            <div className="hover:scale-[1.015] hover:shadow-lg transition-all duration-150 rounded-xl">
              <CardDesign card={item.card} qrDataUrl={item.qrDataUrl} />
            </div>
          </button>
        ))}
      </div>

      {/* Aperçu dialog au clic */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg p-5 gap-4">
          {selected && (
            <>
              {/* Full card preview */}
              <div style={{ containerType: "inline-size" }}>
                <CardDesign card={selected.card} qrDataUrl={selected.qrDataUrl} />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Link href={`/cartes/${selected.card.id}/edit`} className="flex-1">
                  <Button className="w-full bg-green-700 hover:bg-green-800 text-white">
                    <Pencil className="h-4 w-4 mr-1.5" />Modifier
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  className="border-green-700 text-green-700 hover:bg-green-50"
                  onClick={() =>
                    window.open(`/api/cartes/${selected.card.id}/print?auto=0`, "_blank")
                  }
                >
                  <Printer className="h-4 w-4 mr-1.5" />PDF
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

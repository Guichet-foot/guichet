"use client";

import React, { useState } from "react";
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
  Download,
  Pencil,
  ShoppingCart,
  Users,
  TrendingUp,
  Wallet,
  CreditCard,
  Tag,
  FileDown,
  Loader2,
} from "lucide-react";
import type { AccessCard } from "@/lib/types";
import { formatFCFA } from "@/lib/format";

export interface CardWithQR {
  card: AccessCard;
  qrDataUrl: string;
}

type Tab = "zone_delegue" | "vendeur" | "spectateur";

const TABS: { id: Tab; label: string }[] = [
  { id: "zone_delegue", label: "Zone et Délégué" },
  { id: "vendeur", label: "Vendeurs" },
  { id: "spectateur", label: "Spectateurs" },
];

const TYPE_LABELS: Record<string, string> = {
  zone: "ZONE",
  delegue: "DÉLÉGUÉ",
  vendeur: "VENDEUR",
  spectateur: "SPECTATEUR",
  odcav: "ODCAV",
};

const TYPE_COLORS: Record<string, string> = {
  zone: "#166534",
  delegue: "#1D4ED8",
  vendeur: "#B45309",
  spectateur: "#6D28D9",
  odcav: "#7C3AED",
};

function getSaison(card: AccessCard): string {
  if (card.saison) return card.saison;
  const d = new Date(card.created_at);
  const y = d.getFullYear();
  return d.getMonth() + 1 >= 8 ? `${y} - ${y + 1}` : `${y - 1} - ${y}`;
}

/** Card design — scales via container queries (cqi). */
function CardDesign({ card, qrDataUrl, zoneLogo }: { card: AccessCard; qrDataUrl: string; zoneLogo?: string }) {
  const saison = getSaison(card);
  const type = card.card_type || "zone";
  const price = card.price;

  const isOdcavCard = type === "odcav";
  const isPaidCard = type === "vendeur" || type === "spectateur";

  const badgeText = type === "zone" && card.zone_name
    ? card.zone_name.toUpperCase()
    : (TYPE_LABELS[type] || "ZONE");

  const rows: { Icon: React.ElementType; label: string; value: string | null | undefined }[] = [
    { Icon: User,  label: "NOM COMPLET", value: card.full_name },
    { Icon: Phone, label: "TÉLÉPHONE",   value: card.phone },
    ...(!isPaidCard && !isOdcavCard ? [{ Icon: MapPin,     label: "ZONE",     value: card.zone_name }] : []),
    ...(!isPaidCard ? [{ Icon: Briefcase, label: isOdcavCard ? "FONCTION" : "POSTE", value: card.poste }] : []),
    ...(!isOdcavCard && card.asc_name ? [{ Icon: Shield, label: "ASC", value: card.asc_name }] : []),
    ...(price != null && price > 0
      ? [{ Icon: Tag, label: "MONTANT", value: `${price.toLocaleString("fr-FR")} FCFA` }]
      : []),
  ];

  return (
    <div
      className="relative w-full border-[2.5px] border-green-800 rounded-xl overflow-hidden bg-white shadow-md"
      style={{ aspectRatio: "85.6 / 54" }}
    >
      {/* Header */}
      <div
        className="absolute inset-x-0 top-0 flex items-center bg-green-50 border-b border-green-800"
        style={{ height: "30%", padding: "1% 2%" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={zoneLogo || "/logoodcavdes.png"}
          alt="Logo"
          style={{ height: "80%", width: "auto", objectFit: "contain", flexShrink: 0 }}
        />
        <div style={{ flex: 1, textAlign: "center", paddingRight: "25%" }}>
          <p
            className="font-black text-green-800 leading-tight"
            style={{ fontSize: "5.5cqi", lineHeight: 1.05 }}
          >
            CARTE D&apos;ACCÈS
          </p>
          <p
            className="font-semibold text-green-700"
            style={{ fontSize: "2.1cqi", marginTop: "0.2cqi" }}
          >
            — SAISON {saison} —
          </p>
          <div style={{
            marginTop: "0.5cqi",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "1.5cqi",
          }}>
            <span style={{
              backgroundColor: TYPE_COLORS[type] || "#166534",
              color: "white",
              fontSize: "1.6cqi",
              padding: "0.2cqi 1.3cqi",
              borderRadius: "99px",
              fontWeight: 800,
              letterSpacing: "0.06em",
              display: "inline-block",
            }}>
              {badgeText}
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="absolute inset-x-0 bottom-0 flex" style={{ top: "30%" }}>
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
          <div className="border border-green-800" style={{ width: "84%", padding: "1%" }}>
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

      {/* Photo — portrait rectangle, header height + small overflow into body */}
      <div
        className="absolute overflow-hidden bg-green-50"
        style={{
          width: "25%",
          height: "38%",
          top: "3%",
          right: "2%",
          borderRadius: "6px",
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
  zoneLogo?: string;
  readOnly?: boolean;
}

function CartesGrid({ items, zoneLogo, readOnly }: CartesGridProps) {
  const [selected, setSelected] = useState<CardWithQR | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((item) => (
          <button
            key={item.card.id}
            className="text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-green-700 rounded-xl"
            style={{ containerType: "inline-size" }}
            onClick={() => setSelected(item)}
          >
            <div className="hover:scale-[1.015] hover:shadow-lg transition-all duration-150 rounded-xl">
              <CardDesign card={item.card} qrDataUrl={item.qrDataUrl} zoneLogo={zoneLogo} />
            </div>
          </button>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg p-5 gap-4">
          {selected && (
            <>
              <div style={{ containerType: "inline-size" }}>
                <CardDesign card={selected.card} qrDataUrl={selected.qrDataUrl} zoneLogo={zoneLogo} />
              </div>
              <div className="flex gap-2">
                {!readOnly && (
                  <Link href={`/cartes/${selected.card.id}/edit`} className="flex-1">
                    <Button className="w-full bg-green-700 hover:bg-green-800 text-white">
                      <Pencil className="h-4 w-4 mr-1.5" />Modifier
                    </Button>
                  </Link>
                )}
                <a href={`/api/cartes/${selected.card.id}/download`} download>
                  <Button variant="outline" className="border-green-700 text-green-700 hover:bg-green-50">
                    <Download className="h-4 w-4 mr-1.5" />Télécharger
                  </Button>
                </a>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Main client component: stats cards + tabs + filtered grid */
export function CartesClient({ items, zoneLogo, readOnly, odcavOnly }: { items: CardWithQR[]; zoneLogo?: string; readOnly?: boolean; odcavOnly?: boolean }) {
  const [activeTab, setActiveTab] = useState<Tab>("zone_delegue");
  const [downloading, setDownloading] = useState(false);

  // Mode ODCAV : affichage direct sans stats/onglets zone
  if (odcavOnly) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5 border-purple-700 text-purple-700 hover:bg-purple-50"
            onClick={() => downloadBulk(items)}
            disabled={downloading || items.length === 0}
          >
            {downloading
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Génération…</>
              : <><FileDown className="h-3.5 w-3.5" />PDF A4 ({items.length})</>
            }
          </Button>
        </div>
        <CartesGrid items={items} zoneLogo={zoneLogo} readOnly={readOnly} />
      </div>
    );
  }

  async function downloadBulk(cardItems: CardWithQR[]) {
    if (cardItems.length === 0) return;
    setDownloading(true);
    try {
      const ids = cardItems.map((i) => i.card.id);
      const res = await fetch("/api/cartes/bulk-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("Erreur génération PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "cartes-acces.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Erreur lors du téléchargement");
    } finally {
      setDownloading(false);
    }
  }

  const vendeurItems = items.filter((i) => i.card.card_type === "vendeur");
  const spectateurItems = items.filter((i) => i.card.card_type === "spectateur");
  const revenusVendeurs = vendeurItems.reduce((s, i) => s + (i.card.price || 0), 0);
  const revenusSpectateurs = spectateurItems.reduce((s, i) => s + (i.card.price || 0), 0);
  const totalRevenus = revenusVendeurs + revenusSpectateurs;

  const filteredItems =
    activeTab === "zone_delegue"
      ? items.filter(
          (i) => i.card.card_type === "zone" || i.card.card_type === "delegue"
        )
      : activeTab === "vendeur"
      ? vendeurItems
      : spectateurItems;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <CreditCard className="h-16 w-16 mb-4 opacity-20" />
        <p className="font-medium">Aucune carte créée</p>
        <p className="text-sm mt-1">Créez votre première carte d&apos;accès</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {/* Vendeurs count */}
          <div className="rounded-xl p-4 bg-green-100 border border-green-200 flex items-center justify-between">
            <div>
              <p className="text-green-800 font-bold text-sm sm:text-base leading-tight">Vendeurs</p>
              <p className="text-green-900 font-semibold text-base sm:text-lg mt-0.5">
                {vendeurItems.length} Cartes Vendeurs
              </p>
            </div>
            <ShoppingCart className="h-8 w-8 sm:h-10 sm:w-10 text-green-300 shrink-0" />
          </div>

          {/* Spectateurs count */}
          <div className="rounded-xl p-4 bg-indigo-100 border border-indigo-200 flex items-center justify-between">
            <div>
              <p className="text-indigo-800 font-bold text-sm sm:text-base leading-tight">Spectateurs</p>
              <p className="text-indigo-900 font-semibold text-base sm:text-lg mt-0.5">
                {spectateurItems.length} Cartes Spectateurs
              </p>
            </div>
            <Users className="h-8 w-8 sm:h-10 sm:w-10 text-indigo-300 shrink-0" />
          </div>

          {/* Total Revenus */}
          <div className="col-span-2 sm:col-span-1 rounded-xl p-4 bg-green-800 flex items-center justify-between">
            <div>
              <p className="text-white font-bold text-sm sm:text-base leading-tight">REVENUS TOTAL</p>
              <p className="text-white/60 text-xs mt-0.5">Vendeurs + Spectateurs</p>
              <p className="text-white font-bold text-xl sm:text-2xl mt-1">
                {formatFCFA(totalRevenus)}
              </p>
            </div>
            <TrendingUp className="h-10 w-10 sm:h-12 sm:w-12 text-white/20 shrink-0" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Revenus Vendeurs */}
          <div className="rounded-xl p-4 bg-amber-50 border border-amber-200 flex items-center justify-between">
            <div>
              <p className="text-amber-800 font-bold text-sm sm:text-base leading-tight">Revenus Vendeurs</p>
              <p className="text-amber-900 font-semibold text-base sm:text-lg mt-0.5">
                {formatFCFA(revenusVendeurs)}
              </p>
            </div>
            <Wallet className="h-8 w-8 sm:h-10 sm:w-10 text-amber-200 shrink-0" />
          </div>

          {/* Revenus Spectateurs */}
          <div className="rounded-xl p-4 bg-pink-50 border border-pink-200 flex items-center justify-between">
            <div>
              <p className="text-pink-800 font-bold text-sm sm:text-base leading-tight">Revenus spectateurs</p>
              <p className="text-pink-900 font-semibold text-base sm:text-lg mt-0.5">
                {formatFCFA(revenusSpectateurs)}
              </p>
            </div>
            <Wallet className="h-8 w-8 sm:h-10 sm:w-10 text-pink-200 shrink-0" />
          </div>
        </div>
      </div>

      {/* Tabs + bulk download */}
      <div className="border-b border-border flex items-center justify-between">
        <div className="flex">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-green-700 text-green-700"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mb-1 mr-1 text-xs gap-1.5 border-green-700 text-green-700 hover:bg-green-50"
          onClick={() => downloadBulk(filteredItems)}
          disabled={downloading || filteredItems.length === 0}
        >
          {downloading
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Génération…</>
            : <><FileDown className="h-3.5 w-3.5" />PDF A4 ({filteredItems.length})</>
          }
        </Button>
      </div>

      {/* Grid */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <CreditCard className="h-12 w-12 mb-3 opacity-20" />
          <p className="font-medium">Aucune carte dans cet onglet</p>
        </div>
      ) : (
        <CartesGrid items={filteredItems} zoneLogo={zoneLogo} readOnly={readOnly} />
      )}
    </div>
  );
}

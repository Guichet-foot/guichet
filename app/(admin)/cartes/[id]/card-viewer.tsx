"use client";

import { useState } from "react";
import { deleteAccessCard } from "@/lib/actions/carte-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Printer,
  Trash2,
  ArrowLeft,
  Loader2,
  User,
  Phone,
  MapPin,
  Briefcase,
  Shield,
  Pencil,
  Tag,
} from "lucide-react";

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
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { AccessCard } from "@/lib/types";

interface CardViewerProps {
  card: AccessCard;
  qrDataUrl: string;
  printUrl: string;
  zoneLogo?: string;
}

export function CardViewer({ card, qrDataUrl, printUrl, zoneLogo }: CardViewerProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const saison = card.saison || (() => {
    const d = new Date(card.created_at);
    const y = d.getFullYear();
    return d.getMonth() + 1 >= 8 ? `${y} - ${y + 1}` : `${y - 1} - ${y}`;
  })();

  const cardType = card.card_type || "zone";
  const isPaidCard = cardType === "vendeur" || cardType === "spectateur";
  const isOdcavCard = cardType === "odcav";
  const typeColor = TYPE_COLORS[cardType] || "#166534";
  const typeLabel = cardType === "zone" && card.zone_name
    ? card.zone_name.toUpperCase()
    : (TYPE_LABELS[cardType] || "ZONE");

  const infoRows = [
    { Icon: User,      label: "NOM COMPLET", value: card.full_name },
    { Icon: Phone,     label: "TÉLÉPHONE",   value: card.phone },
    ...(!isPaidCard && !isOdcavCard ? [{ Icon: MapPin, label: "ZONE", value: card.zone_name }] : []),
    ...(!isPaidCard ? [{ Icon: Briefcase, label: isOdcavCard ? "FONCTION" : "POSTE", value: card.poste }] : []),
    ...(!isOdcavCard && card.asc_name ? [{ Icon: Shield, label: "ASC", value: card.asc_name }] : []),
    ...(card.price != null && card.price > 0
      ? [{ Icon: Tag, label: "MONTANT", value: `${card.price.toLocaleString("fr-FR")} FCFA` }]
      : []),
  ];

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteAccessCard(card.id);
    setDeleting(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Carte supprimée");
    setDeleteOpen(false);
    router.push("/cartes");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex flex-wrap gap-2 items-center">
        <Button variant="outline" size="sm" onClick={() => router.push("/cartes")}>
          <ArrowLeft className="h-4 w-4 mr-1" />Retour
        </Button>
        <div className="flex-1" />
        <Link href={`/cartes/${card.id}/edit`}>
          <Button variant="outline" size="sm" className="border-green-700 text-green-700 hover:bg-green-50">
            <Pencil className="h-4 w-4 mr-1" />Modifier
          </Button>
        </Link>
        <a href={`/api/cartes/${card.id}/download`} download>
          <Button variant="outline" size="sm" className="border-green-700 text-green-700 hover:bg-green-50">
            <Printer className="h-4 w-4 mr-1" />Télécharger
          </Button>
        </a>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDeleteOpen(true)}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Card preview ── */}
      <Card className="overflow-hidden p-4 bg-gray-100">
        <div className="w-full max-w-xl mx-auto" style={{ containerType: "inline-size" }}>
          <div
            className="relative w-full border-[3px] border-green-800 rounded-2xl overflow-hidden bg-white shadow-lg"
            style={{ aspectRatio: "85.6 / 54" }}
          >
            {/* ── HEADER ── */}
            <div
              className="absolute inset-x-0 top-0 flex items-center bg-green-50 border-b-[1.5px] border-green-800"
              style={{ height: "30%", padding: "1% 2%" }}
            >
              {/* Logo zone ou ODCAV par défaut */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={zoneLogo || "/logoodcavdes.png"}
                alt="Logo"
                style={{ height: "88%", width: "auto", objectFit: "contain", flexShrink: 0 }}
              />

              {/* Title */}
              <div style={{ flex: 1, textAlign: "center", paddingRight: "25%" }}>
                <p
                  className="font-black text-green-800 leading-tight"
                  style={{ fontSize: "5.5cqi", lineHeight: 1.05, letterSpacing: "0.02em" }}
                >
                  CARTE D&apos;ACCÈS
                </p>
                <p
                  className="font-semibold text-green-700"
                  style={{ fontSize: "2.1cqi", marginTop: "0.2cqi" }}
                >
                  — SAISON {saison} —
                </p>
                <div style={{ marginTop: "0.5cqi", display: "flex", justifyContent: "center" }}>
                  <span style={{
                    backgroundColor: typeColor,
                    color: "white",
                    fontSize: "1.6cqi",
                    padding: "0.2cqi 1.3cqi",
                    borderRadius: "99px",
                    fontWeight: 800,
                    letterSpacing: "0.06em",
                    display: "inline-block",
                  }}>
                    {typeLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* ── BODY ── */}
            <div
              className="absolute inset-x-0 bottom-0 flex"
              style={{ top: "30%" }}
            >
              {/* Info rows — 65% */}
              <div className="flex flex-col border-r border-gray-200" style={{ width: "65%" }}>
                {infoRows.map(({ Icon, label, value }, i) => (
                  <div
                    key={label}
                    className="flex items-center"
                    style={{
                      flex: 1,
                      borderBottom: i < infoRows.length - 1 ? "0.5px solid #e5e7eb" : "none",
                      padding: "0 2%",
                      gap: "2%",
                    }}
                  >
                    <div
                      className="flex items-center justify-center rounded bg-green-800 shrink-0"
                      style={{ width: "7cqi", height: "7cqi" }}
                    >
                      <Icon style={{ width: "55%", height: "55%", color: "white" }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p
                        className="font-bold text-green-800 uppercase leading-none"
                        style={{ fontSize: "1.8cqi", letterSpacing: "0.03em" }}
                      >
                        {label}
                      </p>
                      <p
                        className="font-bold text-gray-900 truncate"
                        style={{ fontSize: "2.8cqi", marginTop: "0.2cqi" }}
                      >
                        {value}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* QR — 35% */}
              <div
                className="flex items-end justify-center bg-white"
                style={{ width: "35%", paddingBottom: "2%" }}
              >
                <div className="border border-green-800 p-[1%]" style={{ width: "84%" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrDataUrl}
                    alt="QR"
                    className="w-full block"
                    style={{ imageRendering: "pixelated" }}
                  />
                </div>
              </div>
            </div>

            {/* ── PHOTO — portrait rectangle, header + small overflow ── */}
            <div
              className="absolute overflow-hidden bg-green-100"
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
                  <User className="w-2/5 h-2/5 text-green-700" />
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer la carte ?</DialogTitle>
            <DialogDescription>
              La carte de <strong>{card.full_name}</strong> sera définitivement supprimée.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Annuler
            </Button>
            <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Supprimer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

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
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { AccessCard } from "@/lib/types";

interface CardViewerProps {
  card: AccessCard;
  qrDataUrl: string;
  printUrl: string;
}

export function CardViewer({ card, qrDataUrl, printUrl }: CardViewerProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const saison = card.saison || (() => {
    const d = new Date(card.created_at);
    const y = d.getFullYear();
    return d.getMonth() + 1 >= 8 ? `${y} - ${y + 1}` : `${y - 1} - ${y}`;
  })();

  const infoRows = [
    { Icon: User,      label: "NOM COMPLET", value: card.full_name },
    { Icon: Phone,     label: "TÉLÉPHONE",   value: card.phone },
    { Icon: MapPin,    label: "ZONE",        value: card.zone_name },
    { Icon: Briefcase, label: "POSTE",       value: card.poste },
    ...(card.asc_name ? [{ Icon: Shield, label: "ASC", value: card.asc_name }] : []),
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(`${printUrl}?auto=0`, "_blank")}
          className="border-green-700 text-green-700 hover:bg-green-50"
        >
          <Printer className="h-4 w-4 mr-1" />Imprimer / PDF
        </Button>
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
              style={{ height: "27.8%", padding: "1.5% 2%" }}
            >
              {/* ODCAV logo */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logoodcavdes.png"
                alt="ODCAV"
                style={{ height: "88%", width: "auto", objectFit: "contain", flexShrink: 0 }}
              />

              {/* Title */}
              <div style={{ flex: 1, textAlign: "center", paddingRight: "27%" }}>
                <p
                  className="font-black text-green-800 leading-tight"
                  style={{ fontSize: "6cqi", lineHeight: 1.05, letterSpacing: "0.02em" }}
                >
                  CARTE D&apos;ACCÈS
                </p>
                <p
                  className="font-semibold text-green-700"
                  style={{ fontSize: "2.4cqi", marginTop: "0.5cqi" }}
                >
                  — SAISON {saison} —
                </p>
              </div>
            </div>

            {/* ── BODY ── */}
            <div
              className="absolute inset-x-0 bottom-0 flex"
              style={{ top: "27.8%" }}
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
                style={{ width: "35%", paddingBottom: "2.5%" }}
              >
                <div className="border border-green-800 p-[1.5%]" style={{ width: "72%" }}>
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

            {/* ── PHOTO — top-right absolu ── */}
            <div
              className="absolute rounded-full overflow-hidden bg-green-100"
              style={{
                width: "24%",
                aspectRatio: "1 / 1",
                top: "4%",
                right: "2%",
                border: "3px solid #1a5c2a",
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

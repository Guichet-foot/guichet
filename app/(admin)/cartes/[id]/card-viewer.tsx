"use client";

import { useState } from "react";
import { deleteAccessCard } from "@/lib/actions/carte-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Download,
  Printer,
  Trash2,
  ArrowLeft,
  Loader2,
  User,
  Phone,
  MapPin,
  Briefcase,
  Shield,
  ImageDown,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { AccessCard } from "@/lib/types";

interface CardViewerProps {
  card: AccessCard;
  qrDataUrl: string;
  printUrl: string;
}

/* ---- Inline SVG icon paths for canvas rendering ---- */
const GREEN = "#1a5c2a";
const BORDER_COLOR = "#1a5c2a";

function getSaison(createdAt: string): string {
  const d = new Date(createdAt);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return m >= 8 ? `${y} - ${y + 1}` : `${y - 1} - ${y}`;
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

async function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function CardViewer({ card, qrDataUrl, printUrl }: CardViewerProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pngLoading, setPngLoading] = useState(false);

  const saison = getSaison(card.created_at);

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteAccessCard(card.id);
    setDeleting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Carte supprimée");
    setDeleteOpen(false);
    router.push("/cartes");
    router.refresh();
  }

  function openPrint(autoPrint: boolean) {
    const url = `${printUrl}${autoPrint ? "?auto=1" : "?auto=0"}`;
    window.open(url, "_blank");
  }

  /* ── PNG download using Canvas API ── */
  async function downloadPNG() {
    setPngLoading(true);
    try {
      const S = 10; // 10px per mm → 856×540 canvas
      const W = Math.round(85.6 * S);
      const H = Math.round(54 * S);

      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;

      // White background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);

      // Border
      ctx.strokeStyle = BORDER_COLOR;
      ctx.lineWidth = 3;
      drawRoundRect(ctx, 1.5, 1.5, W - 3, H - 3, 4 * S);
      ctx.stroke();

      const headerH = 15 * S;

      // Header background (very light green)
      ctx.fillStyle = "#f0fdf4";
      drawRoundRect(ctx, 1.5, 1.5, W - 3, headerH, 4 * S);
      ctx.fill();

      // Header bottom separator
      ctx.strokeStyle = BORDER_COLOR;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(1.5, headerH);
      ctx.lineTo(W - 1.5, headerH);
      ctx.stroke();

      // ODCAV logo
      try {
        const logo = await loadImg("/cartemembre.png");
        const logoH = 12 * S;
        const logoAspect = logo.naturalWidth / logo.naturalHeight;
        const logoW = Math.min(logoH * logoAspect, 12 * S);
        ctx.drawImage(logo, 2 * S, (headerH - logoH) / 2, logoW, logoH);
      } catch {
        // logo unavailable — draw placeholder
        ctx.fillStyle = GREEN;
        ctx.beginPath();
        ctx.arc(7 * S, headerH / 2, 5 * S, 0, Math.PI * 2);
        ctx.fill();
      }

      // Title
      ctx.fillStyle = GREEN;
      ctx.textAlign = "center";
      ctx.font = `900 ${8.5 * S / 10}px Arial`;
      ctx.fillText("CARTE D'ACCÈS", W / 2, headerH * 0.44);
      ctx.font = `600 ${5 * S / 10}px Arial`;
      ctx.fillText(`— SAISON ${saison} —`, W / 2, headerH * 0.75);

      // Photo circle (top-right)
      const pD = 12 * S;
      const pX = W - 14 * S;
      const pY = (headerH - pD) / 2;
      const pCX = pX + pD / 2;
      const pCY = pY + pD / 2;

      if (card.photo_url) {
        try {
          const photo = await loadImg(card.photo_url);
          ctx.save();
          ctx.beginPath();
          ctx.arc(pCX, pCY, pD / 2 - 1, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(photo, pX, pY, pD, pD);
          ctx.restore();
        } catch {
          // draw initials if photo fails
          ctx.fillStyle = "#d1fae5";
          ctx.beginPath();
          ctx.arc(pCX, pCY, pD / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = "#d1fae5";
        ctx.beginPath();
        ctx.arc(pCX, pCY, pD / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = GREEN;
        ctx.font = `bold ${6 * S / 10}px Arial`;
        ctx.textAlign = "center";
        ctx.fillText(
          card.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase(),
          pCX, pCY + 2 * S / 10
        );
      }
      // Photo border
      ctx.strokeStyle = GREEN;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(pCX, pCY, pD / 2, 0, Math.PI * 2);
      ctx.stroke();

      // Info rows
      const rightColX = 60 * S;
      const fields = [
        { label: "NOM COMPLET", value: card.full_name },
        { label: "TÉLÉPHONE", value: card.phone },
        { label: "ZONE", value: card.zone_name },
        { label: "POSTE", value: card.poste },
        ...(card.asc_name ? [{ label: "ASC", value: card.asc_name }] : []),
      ];

      const numRows = fields.length;
      const rowH = (H - headerH) / numRows;

      fields.forEach((field, i) => {
        const rowY = headerH + i * rowH;

        // Row separator
        if (i > 0) {
          ctx.strokeStyle = "#e5e7eb";
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(2 * S, rowY);
          ctx.lineTo(rightColX - S, rowY);
          ctx.stroke();
        }

        // Icon box
        const boxX = 2 * S;
        const boxSize = 5 * S;
        const boxY = rowY + (rowH - boxSize) / 2;
        ctx.fillStyle = GREEN;
        drawRoundRect(ctx, boxX, boxY, boxSize, boxSize, 0.8 * S);
        ctx.fill();

        // Label
        ctx.fillStyle = GREEN;
        ctx.font = `700 ${3.8 * S / 10}px Arial`;
        ctx.textAlign = "left";
        ctx.fillText(field.label, boxX + boxSize + 1.5 * S, rowY + rowH * 0.38);

        // Value (truncate if needed)
        ctx.fillStyle = "#111827";
        ctx.font = `700 ${5.5 * S / 10}px Arial`;
        const maxW = rightColX - boxX - boxSize - 3 * S;
        let val = field.value;
        while (ctx.measureText(val).width > maxW && val.length > 3) {
          val = val.slice(0, -2) + "…";
        }
        ctx.fillText(val, boxX + boxSize + 1.5 * S, rowY + rowH * 0.72);
      });

      // Vertical right separator
      ctx.strokeStyle = "#d1d5db";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rightColX, headerH);
      ctx.lineTo(rightColX, H - 1.5);
      ctx.stroke();

      // QR code (bottom right)
      const qrImg = await loadImg(qrDataUrl);
      const qrSize = 21 * S;
      const qrX = rightColX + (W - rightColX - qrSize) / 2;
      const qrY = H - qrSize - 2 * S;
      ctx.strokeStyle = GREEN;
      ctx.lineWidth = 1;
      ctx.strokeRect(qrX - S, qrY - S, qrSize + 2 * S, qrSize + 2 * S);
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

      // Download
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `carte-${card.full_name.replace(/\s+/g, "-")}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, "image/png");
    } catch (err) {
      toast.error("Erreur lors de la génération PNG");
    } finally {
      setPngLoading(false);
    }
  }

  const infoRows = [
    { Icon: User, label: "NOM COMPLET", value: card.full_name },
    { Icon: Phone, label: "TÉLÉPHONE", value: card.phone },
    { Icon: MapPin, label: "ZONE", value: card.zone_name },
    { Icon: Briefcase, label: "POSTE", value: card.poste },
    ...(card.asc_name ? [{ Icon: Shield, label: "ASC", value: card.asc_name }] : []),
  ];

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <Button variant="outline" size="sm" onClick={() => router.push("/cartes")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Retour
        </Button>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={() => openPrint(false)}
          className="border-green-700 text-green-700 hover:bg-green-50"
        >
          <Printer className="h-4 w-4 mr-1" />
          Imprimer / PDF
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={downloadPNG}
          disabled={pngLoading}
          className="border-green-700 text-green-700 hover:bg-green-50"
        >
          {pngLoading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <ImageDown className="h-4 w-4 mr-1" />
          )}
          PNG
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

      {/* Card visual */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {/* Card preview — proportional to 85.6mm × 54mm */}
          <div
            className="relative w-full bg-white border-4 border-green-800 rounded-2xl overflow-hidden"
            style={{ aspectRatio: "85.6 / 54" }}
          >
            {/* Header */}
            <div className="absolute inset-x-0 top-0 flex items-center bg-green-50 border-b-2 border-green-800"
              style={{ height: "27.8%" }}>
              {/* Logo */}
              <div className="h-full flex items-center pl-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/cartemembre.png"
                  alt="ODCAV"
                  className="h-4/5 w-auto object-contain"
                />
              </div>
              {/* Title */}
              <div className="flex-1 text-center px-2">
                <p className="font-black text-green-800 leading-tight"
                  style={{ fontSize: "clamp(8px, 2vw, 18px)" }}>
                  CARTE D&apos;ACCÈS
                </p>
                <p className="font-semibold text-green-700"
                  style={{ fontSize: "clamp(5px, 1.2vw, 11px)" }}>
                  — SAISON {saison} —
                </p>
              </div>
              {/* Photo */}
              <div className="pr-3">
                <div
                  className="rounded-full border-2 border-green-800 overflow-hidden bg-green-100"
                  style={{ width: "clamp(40px, 12%, 60px)", height: "clamp(40px, 12%, 60px)" }}
                >
                  {card.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={card.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-1/2 h-1/2 text-green-700" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="absolute inset-x-0 bottom-0 flex" style={{ top: "27.8%" }}>
              {/* Info rows */}
              <div className="flex-1 flex flex-col divide-y divide-gray-100 border-r border-gray-200">
                {infoRows.map(({ Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-1.5 px-2 flex-1">
                    <div className="flex-shrink-0 rounded bg-green-800 flex items-center justify-center"
                      style={{ width: "clamp(14px, 4%, 22px)", height: "clamp(14px, 4%, 22px)" }}>
                      <Icon className="text-white" style={{ width: "60%", height: "60%" }} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-green-800 uppercase leading-none truncate"
                        style={{ fontSize: "clamp(4px, 0.9vw, 8px)" }}>
                        {label}
                      </p>
                      <p className="font-bold text-gray-900 truncate"
                        style={{ fontSize: "clamp(6px, 1.3vw, 12px)" }}>
                        {value}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Right: QR */}
              <div className="flex flex-col items-center justify-center bg-white"
                style={{ width: "27%" }}>
                <div className="border border-green-800 p-0.5 rounded">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrDataUrl}
                    alt="QR"
                    className="block"
                    style={{ width: "clamp(60px, 18%, 90px)", height: "clamp(60px, 18%, 90px)" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer la carte ?</DialogTitle>
            <DialogDescription>
              La carte de <strong>{card.full_name}</strong> sera définitivement supprimée.
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Annuler
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Supprimer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

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

const GREEN = "#1a5c2a";

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

  /* ── PNG download via Canvas API ── */
  async function downloadPNG() {
    setPngLoading(true);
    try {
      const S = 10; // 10 px/mm → 856 × 540
      const W = Math.round(85.6 * S);
      const H = Math.round(54 * S);
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d")!;

      // White fill
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, W, H);

      // Border
      ctx.strokeStyle = GREEN; ctx.lineWidth = 4;
      drawRoundRect(ctx, 2, 2, W - 4, H - 4, 5 * S);
      ctx.stroke();

      const headerH = Math.round(0.278 * H); // 15mm

      // Header BG
      ctx.fillStyle = "#f0fdf4";
      drawRoundRect(ctx, 2, 2, W - 4, headerH - 2, 5 * S);
      ctx.fill();

      // Header bottom line
      ctx.strokeStyle = GREEN; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(2, headerH); ctx.lineTo(W - 2, headerH);
      ctx.stroke();

      // ── Photo (top-right, overlapping header/body) ──
      const pD = Math.round(0.24 * W); // 24% of card width ≈ 38% of height
      const pX = W - Math.round(0.02 * W) - pD;
      const pY = Math.round(0.03 * H);
      const pCX = pX + pD / 2;
      const pCY = pY + pD / 2;

      if (card.photo_url) {
        try {
          const photo = await loadImg(card.photo_url);
          ctx.save();
          ctx.beginPath(); ctx.arc(pCX, pCY, pD / 2 - 2, 0, Math.PI * 2); ctx.clip();
          ctx.drawImage(photo, pX, pY, pD, pD);
          ctx.restore();
        } catch { /* placeholder */ }
      } else {
        // Placeholder circle
        ctx.fillStyle = "#d1fae5";
        ctx.beginPath(); ctx.arc(pCX, pCY, pD / 2 - 2, 0, Math.PI * 2); ctx.fill();
      }
      // Photo border
      ctx.strokeStyle = GREEN; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(pCX, pCY, pD / 2, 0, Math.PI * 2); ctx.stroke();

      // ── ODCAV logo — white background container so logo is always visible ──
      const logoBoxH = Math.round(0.84 * headerH);
      const logoBoxW = logoBoxH; // square
      const logoBoxX = 2.5 * S;
      const logoBoxY = (headerH - logoBoxH) / 2;
      ctx.fillStyle = "#ffffff";
      drawRoundRect(ctx, logoBoxX, logoBoxY, logoBoxW, logoBoxH, 0.6 * S);
      ctx.fill();
      try {
        const logo = await loadImg("/logoodcavdes.png");
        const pad = 0.05 * logoBoxH;
        ctx.drawImage(logo, logoBoxX + pad, logoBoxY + pad, logoBoxW - 2 * pad, logoBoxH - 2 * pad);
      } catch { /* skip */ }

      // ── Title (centered between logo and photo) ──
      const logoEndX = logoBoxX + logoBoxW + S;
      const titleCX = logoEndX + (pX - 2 * S - logoEndX) / 2;

      ctx.fillStyle = GREEN; ctx.textAlign = "center";
      ctx.font = `900 ${0.68 * headerH}px Arial`;
      ctx.fillText("CARTE D'ACCÈS", titleCX, headerH * 0.46);
      ctx.font = `600 ${0.37 * headerH}px Arial`;
      ctx.fillText(`— SAISON ${saison} —`, titleCX, headerH * 0.80);

      // ── Info rows ──
      const rightColX = Math.round(0.65 * W);
      const numRows = infoRows.length;
      const rowH = (H - headerH) / numRows;

      infoRows.forEach(({ label, value }, i) => {
        const rowY = headerH + i * rowH;
        if (i > 0) {
          ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 0.5;
          ctx.beginPath(); ctx.moveTo(2 * S, rowY); ctx.lineTo(rightColX - S, rowY); ctx.stroke();
        }
        const boxSide = Math.round(0.62 * rowH);
        const boxX = 2 * S;
        const boxY = rowY + (rowH - boxSide) / 2;
        ctx.fillStyle = GREEN;
        drawRoundRect(ctx, boxX, boxY, boxSide, boxSide, 0.8 * S); ctx.fill();

        ctx.fillStyle = GREEN;
        ctx.font = `700 ${0.28 * rowH}px Arial`; ctx.textAlign = "left";
        ctx.fillText(label, boxX + boxSide + 1.5 * S, rowY + rowH * 0.38);

        ctx.fillStyle = "#111";
        ctx.font = `700 ${0.42 * rowH}px Arial`;
        const maxW = rightColX - boxX - boxSide - 4 * S;
        let val = value;
        while (ctx.measureText(val).width > maxW && val.length > 3) val = val.slice(0, -2) + "…";
        ctx.fillText(val, boxX + boxSide + 1.5 * S, rowY + rowH * 0.72);
      });

      // Right separator
      ctx.strokeStyle = "#d1d5db"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(rightColX, headerH); ctx.lineTo(rightColX, H - 2); ctx.stroke();

      // ── QR code (bottom of right column) ──
      const qrImg = await loadImg(qrDataUrl);
      const qrS = Math.round(0.22 * W); // 22% of card width
      const qrX = rightColX + (W - rightColX - qrS) / 2;
      const qrY = H - qrS - 2.5 * S;
      ctx.strokeStyle = GREEN; ctx.lineWidth = 1;
      ctx.strokeRect(qrX - S, qrY - S, qrS + 2 * S, qrS + 2 * S);
      ctx.drawImage(qrImg, qrX, qrY, qrS, qrS);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `carte-${card.full_name.replace(/\s+/g, "-")}.png`;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
      }, "image/png");
    } catch {
      toast.error("Erreur génération PNG");
    } finally {
      setPngLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex flex-wrap gap-2 items-center">
        <Button variant="outline" size="sm" onClick={() => router.push("/cartes")}>
          <ArrowLeft className="h-4 w-4 mr-1" />Retour
        </Button>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => window.open(`${printUrl}?auto=0`, "_blank")}
          className="border-green-700 text-green-700 hover:bg-green-50">
          <Printer className="h-4 w-4 mr-1" />Imprimer / PDF
        </Button>
        <Button variant="outline" size="sm" onClick={downloadPNG} disabled={pngLoading}
          className="border-green-700 text-green-700 hover:bg-green-50">
          {pngLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ImageDown className="h-4 w-4 mr-1" />}
          PNG
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)}
          className="text-destructive hover:text-destructive hover:bg-destructive/10">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Card preview ── */}
      <Card className="overflow-hidden p-4 bg-gray-100">
        <div className="w-full max-w-xl mx-auto" style={{ containerType: "inline-size" }}>
          {/*
            Aspect ratio 85.6:54 ≈ 1.585:1
            Photo is absolutely positioned (large, top-right, overlapping header/body).
            cqi units for fonts (container query inline-size = card width).
          */}
          <div
            className="relative w-full border-[3px] border-green-800 rounded-2xl overflow-hidden bg-white shadow-lg"
            style={{ aspectRatio: "85.6 / 54" }}
          >
            {/* ── HEADER ── */}
            <div
              className="absolute inset-x-0 top-0 flex items-center bg-green-50 border-b-[1.5px] border-green-800"
              style={{ height: "27.8%", padding: "1.5% 2%" }}
            >
              {/* ODCAV logo — fond blanc pour garantir la visibilité */}
              <div
                className="shrink-0 flex items-center justify-center rounded-lg overflow-hidden"
                style={{ height: "88%", aspectRatio: "1/1", background: "white", padding: "2px" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logoodcavdes.png"
                  alt="ODCAV"
                  style={{ height: "100%", width: "100%", objectFit: "contain" }}
                />
              </div>

              {/* Title — centré entre logo et zone photo */}
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
              {/* Info rows — 65% width */}
              <div
                className="flex flex-col border-r border-gray-200"
                style={{ width: "65%" }}
              >
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

              {/* Right column — 35% width, QR at bottom */}
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

            {/* ── PHOTO — absolue, top-right, chevauchant en-tête/corps ── */}
            {/* width: 24% de la largeur ≈ 38% de la hauteur de la carte */}
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

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

  const infoRows = [
    { Icon: User,     label: "NOM COMPLET", value: card.full_name },
    { Icon: Phone,    label: "TÉLÉPHONE",   value: card.phone },
    { Icon: MapPin,   label: "ZONE",        value: card.zone_name },
    { Icon: Briefcase,label: "POSTE",       value: card.poste },
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
      const S = 10; // 10 px per mm → 856 × 540
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

      const headerH = 15 * S;

      // Header BG
      ctx.fillStyle = "#f0fdf4";
      drawRoundRect(ctx, 2, 2, W - 4, headerH - 2, 5 * S);
      ctx.fill();

      // Header bottom line
      ctx.strokeStyle = GREEN; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(2, headerH); ctx.lineTo(W - 2, headerH);
      ctx.stroke();

      // ODCAV logo
      try {
        const logo = await loadImg("/LOGO-ODCAV-MBOUR.png");
        const lH = 12 * S;
        const lW = logo.naturalWidth / logo.naturalHeight * lH;
        ctx.drawImage(logo, 2.5 * S, (headerH - lH) / 2, lW, lH);
      } catch { /* skip */ }

      // Title
      ctx.fillStyle = GREEN; ctx.textAlign = "center";
      ctx.font = `900 ${7.5 * S / 10}px Arial`;
      ctx.fillText("CARTE D'ACCÈS", W / 2, headerH * 0.43);
      ctx.font = `600 ${4.5 * S / 10}px Arial`;
      ctx.fillText(`— SAISON ${saison} —`, W / 2, headerH * 0.75);

      // Photo circle
      const pD = 12 * S;
      const pX = W - 2.5 * S - pD;
      const pY = (headerH - pD) / 2;
      const pCX = pX + pD / 2, pCY = pY + pD / 2;

      if (card.photo_url) {
        try {
          const photo = await loadImg(card.photo_url);
          ctx.save();
          ctx.beginPath(); ctx.arc(pCX, pCY, pD / 2 - 1, 0, Math.PI * 2); ctx.clip();
          ctx.drawImage(photo, pX, pY, pD, pD);
          ctx.restore();
        } catch { /* placeholder */ }
      }
      // Photo border
      ctx.strokeStyle = GREEN; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(pCX, pCY, pD / 2, 0, Math.PI * 2); ctx.stroke();

      // Info rows
      const rightColX = 61 * S;
      const numRows = infoRows.length;
      const rowH = (H - headerH) / numRows;

      infoRows.forEach(({ label, value }, i) => {
        const rowY = headerH + i * rowH;
        if (i > 0) {
          ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 0.5;
          ctx.beginPath(); ctx.moveTo(2 * S, rowY); ctx.lineTo(rightColX - S, rowY); ctx.stroke();
        }
        const boxX = 2 * S, boxH = 5 * S;
        const boxY = rowY + (rowH - boxH) / 2;
        ctx.fillStyle = GREEN;
        drawRoundRect(ctx, boxX, boxY, boxH, boxH, 0.8 * S); ctx.fill();

        ctx.fillStyle = GREEN;
        ctx.font = `700 ${3.6 * S / 10}px Arial`; ctx.textAlign = "left";
        ctx.fillText(label, boxX + boxH + 1.5 * S, rowY + rowH * 0.38);

        ctx.fillStyle = "#111";
        ctx.font = `700 ${5.5 * S / 10}px Arial`;
        const maxW = rightColX - boxX - boxH - 3 * S;
        let val = value;
        while (ctx.measureText(val).width > maxW && val.length > 3) val = val.slice(0, -2) + "…";
        ctx.fillText(val, boxX + boxH + 1.5 * S, rowY + rowH * 0.72);
      });

      // Right separator
      ctx.strokeStyle = "#d1d5db"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(rightColX, headerH); ctx.lineTo(rightColX, H - 2); ctx.stroke();

      // QR code
      const qrImg = await loadImg(qrDataUrl);
      const qrS = 20 * S;
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
      {/*
        Aspect ratio 85.6:54 ≈ 1.585:1
        We use a container-query div so font sizes scale with the card width.
      */}
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
              {/* ODCAV Logo */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/LOGO-ODCAV-MBOUR.png"
                alt="ODCAV"
                style={{ height: "88%", width: "auto", objectFit: "contain", flexShrink: 0 }}
              />

              {/* Title */}
              <div className="flex-1 text-center" style={{ padding: "0 2%" }}>
                <p
                  className="font-black text-green-800 leading-tight"
                  style={{ fontSize: "4.2cqi", lineHeight: 1.1 }}
                >
                  CARTE D&apos;ACCÈS
                </p>
                <p
                  className="font-semibold text-green-700"
                  style={{ fontSize: "2.2cqi", marginTop: "0.5cqi" }}
                >
                  — SAISON {saison} —
                </p>
              </div>

              {/* Photo */}
              <div
                className="rounded-full border-2 border-green-800 overflow-hidden bg-green-100 shrink-0"
                style={{ height: "88%", aspectRatio: "1/1" }}
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

            {/* ── BODY ── */}
            <div
              className="absolute inset-x-0 bottom-0 flex"
              style={{ top: "27.8%" }}
            >
              {/* Info rows — 70% width */}
              <div
                className="flex flex-col border-r border-gray-200"
                style={{ width: "70%" }}
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
                    {/* Icon box */}
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

              {/* QR code — 30% width */}
              <div
                className="flex items-end justify-center bg-white"
                style={{ width: "30%", paddingBottom: "2.5%" }}
              >
                <div className="border border-green-800 p-[1.5%]" style={{ width: "75%" }}>
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

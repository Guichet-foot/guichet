import { NextResponse } from "next/server";
import { getAccessCard } from "@/lib/actions/carte-actions";
import QRCode from "qrcode";
import { readFileSync } from "fs";
import { join } from "path";

/* eslint-disable @typescript-eslint/no-explicit-any */

function getSaison(card: { saison?: string | null; created_at: string }): string {
  if (card.saison) return card.saison;
  const d = new Date(card.created_at);
  const y = d.getFullYear();
  return d.getMonth() + 1 >= 8 ? `${y} - ${y + 1}` : `${y - 1} - ${y}`;
}

async function fetchBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");
    const ct = res.headers.get("content-type") || "image/jpeg";
    return `data:${ct};base64,${b64}`;
  } catch {
    return null;
  }
}

const ICON_USER = `<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`;
const ICON_PHONE = `<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.56 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>`;
const ICON_MAP = `<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>`;
const ICON_BADGE = `<rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>`;
const ICON_SHIELD = `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`;
const ICON_TAG = `<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>`;

const TYPE_LABELS: Record<string, string> = {
  zone: "ZONE", delegue: "DÉLÉGUÉ", vendeur: "VENDEUR", spectateur: "SPECTATEUR",
};
const TYPE_COLORS: Record<string, string> = {
  zone: "#166534", delegue: "#1D4ED8", vendeur: "#B45309", spectateur: "#6D28D9",
};

function svgIcon(path: string) {
  return `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

function infoRow(iconPath: string, label: string, value: string) {
  return `
<div class="row">
  <div class="icon-box">${svgIcon(iconPath)}</div>
  <div>
    <div class="field-label">${label}</div>
    <div class="field-value">${value}</div>
  </div>
</div>`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const autoPrint = searchParams.get("auto") !== "0";

  const card = await getAccessCard(id);
  if (!card) return new NextResponse("Carte introuvable", { status: 404 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://guichet-pi.vercel.app";
  const qrContent = `${appUrl}/carte/${card.qr_token}`;
  const saison = getSaison(card);
  const cardType = (card as any).card_type || "zone";
  const isPaidCard = cardType === "vendeur" || cardType === "spectateur";
  const typeLabel = TYPE_LABELS[cardType] || "ZONE";
  const typeColor = TYPE_COLORS[cardType] || "#166534";

  // Embed logo
  let logoDataUrl: string;
  try {
    const logoBuf = readFileSync(join(process.cwd(), "public", "logoodcavdes.png"));
    logoDataUrl = `data:image/png;base64,${logoBuf.toString("base64")}`;
  } catch {
    logoDataUrl = "";
  }

  // Embed photo (fetch from Supabase Storage)
  const photoDataUrl = card.photo_url ? await fetchBase64(card.photo_url) : null;

  // Default avatar SVG if no photo
  const photoHtml = photoDataUrl
    ? `<img src="${photoDataUrl}" class="photo" alt="" />`
    : `<div class="photo-placeholder">
         <svg viewBox="0 0 24 24" fill="none" stroke="#1a5c2a" stroke-width="1.5" width="60%" height="60%">
           <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
           <circle cx="12" cy="7" r="4"/>
         </svg>
       </div>`;

  // QR code
  const qrDataUrl = await QRCode.toDataURL(qrContent, {
    width: 300,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#ffffff" },
  });

  // Build info rows
  const cardPrice = (card as any).price as number | null;
  const rows = [
    infoRow(ICON_USER, "NOM COMPLET", card.full_name),
    infoRow(ICON_PHONE, "TÉLÉPHONE", card.phone),
    infoRow(ICON_MAP, "ZONE", card.zone_name),
    ...(!isPaidCard ? [infoRow(ICON_BADGE, "POSTE", card.poste || "")] : []),
    ...(card.asc_name ? [infoRow(ICON_SHIELD, "ASC", card.asc_name)] : []),
    ...(cardPrice ? [infoRow(ICON_TAG, "MONTANT", `${cardPrice.toLocaleString("fr-FR")} FCFA`)] : []),
  ];

  const numRows = rows.length;
  const rowH = (39 / numRows).toFixed(2); // mm per row

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Carte — ${card.full_name}</title>
<style>
@page {
  size: 85.6mm 54mm;
  margin: 0;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body {
  width: 85.6mm;
  height: 54mm;
  font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;
  background: white;
  color: #111;
}
.card {
  position: relative;
  width: 85.6mm;
  height: 54mm;
  border: 1.5pt solid #1a5c2a;
  border-radius: 5mm;
  overflow: hidden;
}
/* Header */
.header {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 16.2mm;
  display: flex;
  align-items: center;
  background: #f0fdf4;
  border-bottom: 1pt solid #1a5c2a;
  padding: 0.8mm 2mm;
}
.logo-wrap {
  height: 13mm;
  width: 13mm;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.logo {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.title-section {
  flex: 1;
  text-align: center;
  /* leave room for the smaller photo on the right (21mm + 1.5mm margin) */
  padding-right: 23mm;
}
.title {
  font-size: 9pt;
  font-weight: 900;
  color: #1a5c2a;
  letter-spacing: 0.3px;
  line-height: 1.05;
}
.season {
  font-size: 4.5pt;
  font-weight: 600;
  color: #1a5c2a;
  margin-top: 0.3mm;
}
.type-badge {
  display: inline-block;
  margin-top: 0.5mm;
  padding: 0.3mm 1.5mm;
  border-radius: 99px;
  font-size: 3.8pt;
  font-weight: 900;
  letter-spacing: 0.4px;
  color: white;
  background: ${typeColor};
}
/* Body */
.body {
  position: absolute;
  top: 16.2mm; left: 0; right: 0; bottom: 0;
  display: flex;
}
.info-col {
  width: 55.6mm; /* 65% of 85.6mm */
  display: flex;
  flex-direction: column;
  border-right: 0.5pt solid #d1d5db;
  overflow: hidden;
}
.row {
  display: flex;
  align-items: center;
  padding: 0 1.5mm;
  flex: 1;
  border-bottom: 0.3pt solid #e5e7eb;
  height: ${rowH}mm;
  overflow: hidden;
}
.row:last-child { border-bottom: none; }
.icon-box {
  width: 4.5mm;
  height: 4.5mm;
  background: #1a5c2a;
  border-radius: 0.7mm;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0.7mm;
  margin-right: 1.5mm;
}
.field-label {
  font-size: 3.2pt;
  color: #1a5c2a;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.2px;
  line-height: 1;
  margin-bottom: 0.3mm;
}
.field-value {
  font-size: 5pt;
  font-weight: 700;
  color: #111827;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 48mm;
}
/* Right column */
.right-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding: 1.5mm 1.5mm 2mm;
}
.qr-box {
  border: 0.5pt solid #1a5c2a;
  padding: 0.5mm;
  display: flex;
}
.qr-box img {
  width: 18mm;
  height: 18mm;
  display: block;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
/* Photo — top-right, overlapping header+body */
/* 21mm diameter ≈ 39% of card height (54mm) */
.photo-wrap {
  position: absolute;
  top: 2mm;
  right: 1.5mm;
  width: 21mm;
  height: 21mm;
  border-radius: 50%;
  border: 1.5pt solid #1a5c2a;
  overflow: hidden;
  background: #d1fae5;
}
.photo-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.photo-placeholder-svg {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.no-print { display: none; }
@media screen {
  html, body { background: #f3f4f6; height: auto; width: auto; padding: 10mm; }
  .card { margin: 0 auto; box-shadow: 0 4px 24px rgba(0,0,0,0.12); }
  .no-print { display: block !important; }
}
</style>
</head>
<body>
<div class="card">
  <!-- Header -->
  <div class="header">
    <div class="logo-wrap">
      ${logoDataUrl ? `<img src="${logoDataUrl}" class="logo" alt="ODCAV" />` : `<div style="width:100%;height:100%;background:#d1fae5;border-radius:50%;"></div>`}
    </div>
    <div class="title-section">
      <div class="title">CARTE D'ACCÈS</div>
      <div class="season">— SAISON ${saison} —</div>
      <div class="type-badge">${typeLabel}</div>
    </div>
  </div>

  <!-- Body -->
  <div class="body">
    <div class="info-col">
      ${rows.join("")}
    </div>
    <div class="right-col">
      <div class="qr-box">
        <img src="${qrDataUrl}" alt="QR" />
      </div>
    </div>
  </div>

  <!-- Photo: large circle, overlapping header+body top-right -->
  <div class="photo-wrap">
    ${photoDataUrl
      ? `<img src="${photoDataUrl}" alt="" />`
      : `<div class="photo-placeholder-svg">
           <svg viewBox="0 0 24 24" fill="none" stroke="#1a5c2a" stroke-width="1.5" width="55%" height="55%">
             <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
             <circle cx="12" cy="7" r="4"/>
           </svg>
         </div>`
    }
  </div>
</div>

<div class="no-print" style="text-align:center;margin-top:6mm;font-family:Arial,sans-serif;font-size:10pt;color:#555;">
  <button onclick="window.print()" style="padding:3mm 8mm;font-size:10pt;cursor:pointer;background:#1a5c2a;color:white;border:none;border-radius:4mm;font-weight:bold;">
    Imprimer / Télécharger PDF
  </button>
  <p style="font-size:8pt;margin-top:3mm;color:#9ca3af;">
    Dans la boîte d'impression → choisir "Enregistrer en PDF"
  </p>
</div>

${autoPrint ? `<script>window.onload = function() { setTimeout(window.print, 400); };</script>` : ""}
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

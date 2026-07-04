import { NextResponse } from "next/server";
import { getAccessCard } from "@/lib/actions/carte-actions";
import QRCode from "qrcode";
import { readFileSync } from "fs";
import { join } from "path";

/* eslint-disable @typescript-eslint/no-explicit-any */

function getSaison(createdAt: string): string {
  const d = new Date(createdAt);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return m >= 8 ? `${y} - ${y + 1}` : `${y - 1} - ${y}`;
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
  const saison = getSaison(card.created_at);

  // Embed logo
  let logoDataUrl: string;
  try {
    const logoBuf = readFileSync(join(process.cwd(), "public", "cartemembre.png"));
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
  const rows = [
    infoRow(ICON_USER, "NOM COMPLET", card.full_name),
    infoRow(ICON_PHONE, "TÉLÉPHONE", card.phone),
    infoRow(ICON_MAP, "ZONE", card.zone_name),
    infoRow(ICON_BADGE, "POSTE", card.poste),
    ...(card.asc_name ? [infoRow(ICON_SHIELD, "ASC", card.asc_name)] : []),
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
  width: 85.6mm;
  height: 54mm;
  border: 1.5pt solid #1a5c2a;
  border-radius: 5mm;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
/* Header */
.header {
  display: flex;
  align-items: center;
  background: #f0fdf4;
  border-bottom: 1pt solid #1a5c2a;
  padding: 1mm 2mm;
  height: 15mm;
  flex-shrink: 0;
}
.logo {
  height: 12mm;
  width: auto;
  max-width: 15mm;
  object-fit: contain;
}
.title-section {
  flex: 1;
  text-align: center;
  padding: 0 1mm;
}
.title {
  font-size: 7.5pt;
  font-weight: 900;
  color: #1a5c2a;
  letter-spacing: 0.3px;
  line-height: 1.1;
}
.season {
  font-size: 4.5pt;
  font-weight: 600;
  color: #1a5c2a;
  margin-top: 0.5mm;
}
.photo {
  width: 12mm;
  height: 12mm;
  border-radius: 50%;
  border: 1pt solid #1a5c2a;
  object-fit: cover;
  flex-shrink: 0;
}
.photo-placeholder {
  width: 12mm;
  height: 12mm;
  border-radius: 50%;
  border: 1pt solid #1a5c2a;
  background: #d1fae5;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
/* Body */
.body {
  display: flex;
  flex: 1;
  overflow: hidden;
}
.info-col {
  flex: 1;
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
  width: 5mm;
  height: 5mm;
  background: #1a5c2a;
  border-radius: 0.8mm;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0.8mm;
  margin-right: 1.5mm;
}
.field-label {
  font-size: 3.5pt;
  color: #1a5c2a;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.2px;
  line-height: 1;
  margin-bottom: 0.3mm;
}
.field-value {
  font-size: 5.5pt;
  font-weight: 700;
  color: #111827;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 50mm;
}
/* Right column */
.right-col {
  width: 25mm;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding: 1.5mm 1.5mm 2mm;
  gap: 1mm;
}
.qr-box {
  border: 0.5pt solid #1a5c2a;
  border-radius: 0.8mm;
  padding: 0.5mm;
  display: flex;
}
.qr-box img {
  width: 20mm;
  height: 20mm;
  display: block;
  image-rendering: pixelated;
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
  <div class="header">
    ${logoDataUrl ? `<img src="${logoDataUrl}" class="logo" alt="ODCAV" />` : `<div style="width:12mm;height:12mm;background:#d1fae5;border-radius:50%;flex-shrink:0;"></div>`}
    <div class="title-section">
      <div class="title">CARTE D&apos;ACCÈS</div>
      <div class="season">— SAISON ${saison} —</div>
    </div>
    ${photoHtml}
  </div>
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

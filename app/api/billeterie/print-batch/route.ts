import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import QRCode from "qrcode";
import { getPrintStyles } from "@/lib/ticket-print-template";
import type { PrintFormat } from "@/lib/ticket-print-template";
import { fmtZone } from "@/lib/format";
import { fetchAll } from "@/lib/supabase/paginate";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── "Billet personnalisé" (design finales) — poster-style ticket ──────────
// Laid out directly in mm (same approach as the standard thermal tickets in
// lib/ticket-print-template.ts) instead of a px canvas + CSS transform: print
// engines (Chrome's print-to-PDF included) don't reliably honor `transform:
// scale()` the same way they render on screen, which silently produced a
// much smaller QR code and team-name text on paper than in the on-screen
// preview. Every position/size below is `mm(originalDesignPx)`, converting
// the original 1024px-wide design 1:1 proportionally into physical mm — the
// same layout, just expressed in a unit print engines handle correctly.
const FIN_W = 1024;
const FIN_H = 1670;
const FIN_PAGE_MM_W = 145;
const FIN_PAGE_MM_H = (FIN_PAGE_MM_W * FIN_H) / FIN_W;
const PX_TO_MM = FIN_PAGE_MM_W / FIN_W;
function mm(px: number): string {
  return (px * PX_TO_MM).toFixed(2) + "mm";
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Inline SVG trophy (Lucide "trophy" path) — replaces the old raster image
// so no extra file has to be fetched/decoded per printed ticket.
const TROPHY_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%">
  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
  <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
  <path d="M4 22h16"/>
  <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
  <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
  <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" fill="#111"/>
</svg>`;

function renderFinalesTicket(
  ticket: { serial_number: string; created_at: string },
  title: string,
  dateLabel: string | null,
  priceLabel: string,
  matches: Array<{ home: string; away: string }>,
  venue: string | null,
  qrDataUrl: string,
  organizerLogoUrl: string,
  backgroundImageUrl: string
): string {
  const words = title.trim().split(/\s+/);
  const titleMain = escapeHtml(words[0] || title);
  const titleSub = escapeHtml(words.slice(1).join(" "));
  const createdAtFmt = format(new Date(ticket.created_at), "dd/MM/yyyy HH:mm", { locale: fr });

  const matchRows = matches.map((m) => `
    <div class="fin-match-row">
      <div class="fin-ball"></div>
      <div class="fin-team">${escapeHtml(m.home)}</div>
      <div class="fin-vs">VS</div>
      <div class="fin-team">${escapeHtml(m.away)}</div>
      <div class="fin-ball"></div>
    </div>`).join("");

  const venueHtml = venue ? `
    <div class="fin-venue">
      <svg width="30" height="38" viewBox="0 0 24 30"><path d="M12 0C5.4 0 0 5.2 0 11.6 0 20.3 12 30 12 30s12-9.7 12-18.4C24 5.2 18.6 0 12 0z" fill="#fff"></path><circle cx="12" cy="11.5" r="4.5" fill="#111"></circle></svg>
      <span>${escapeHtml(venue.toUpperCase())}</span>
    </div>` : "";

  const bgUrl = backgroundImageUrl || "/billet-finales/stade-default.jpg";

  return `
<div class="fin-page">
  <div class="fin-ticket">
    <div class="fin-bg" style="background-image:url('${escapeHtml(bgUrl)}');"></div>
    <div class="fin-bg-fade"></div>

    <div class="fin-header">
      ${organizerLogoUrl ? `<img src="${escapeHtml(organizerLogoUrl)}" alt="Organisateur" class="fin-org-logo">` : ""}
    </div>
    <div class="fin-sep" style="top:${mm(322)};"></div>

    <div class="fin-title-block">
      <div class="fin-title-row">
        <div class="fin-troph fin-troph-l">${TROPHY_SVG}</div>
        <div class="fin-troph fin-troph-r">${TROPHY_SVG}</div>
        <div class="fin-title-main">${titleMain}</div>
      </div>
      ${titleSub ? `<div class="fin-title-sub">${titleSub}</div>` : ""}
      ${dateLabel ? `<div class="fin-date">${escapeHtml(dateLabel.toUpperCase())}</div>` : ""}
      <div class="fin-price">${escapeHtml(priceLabel)}</div>
    </div>

    ${matches.length > 0 ? `<div class="fin-matches">${matchRows}</div>` : ""}

    ${venueHtml}

    <div class="fin-qr-box"><img src="${qrDataUrl}" alt="QR"></div>
    <div class="fin-issuer">
      <div class="fin-ticket-id">${escapeHtml(ticket.serial_number)}</div>
      <div class="fin-issuer-line">${createdAtFmt}</div>
    </div>

    <div class="fin-sep" style="top:210mm;"></div>
    <div class="fin-norefund">Non remboursable</div>
    <div class="fin-footer">
      <div class="fin-footer-line"></div>
      <div class="fin-ball fin-ball-lg"></div>
      <div class="fin-bonmatch">BON MATCH !</div>
      <div class="fin-ball fin-ball-lg"></div>
      <div class="fin-footer-line"></div>
    </div>
  </div>
</div>`;
}

const FIN_CSS = `
@font-face { font-family:'Anton'; font-style:normal; font-weight:400; font-display:swap; src:url('/billet-finales/fonts/anton-400.woff2') format('woff2'); }
@font-face { font-family:'Archivo'; font-style:normal; font-weight:500 900; font-display:swap; src:url('/billet-finales/fonts/archivo-var.woff2') format('woff2'); }
@font-face { font-family:'Oswald'; font-style:normal; font-weight:400 700; font-display:swap; src:url('/billet-finales/fonts/oswald-var.woff2') format('woff2'); }
@page { size: ${FIN_PAGE_MM_W}mm ${FIN_PAGE_MM_H}mm; margin: 0; }
* { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; color-adjust:exact; }
body { background:#fff; }
.fin-page { width:${FIN_PAGE_MM_W}mm; height:${FIN_PAGE_MM_H}mm; overflow:hidden; position:relative; break-after: page; }
.fin-page:last-child { break-after: auto; }
.fin-ticket {
  position:relative; width:${FIN_PAGE_MM_W}mm; height:${FIN_PAGE_MM_H}mm;
  background:#fff; border:${mm(6)} solid #111; overflow:hidden;
  font-family:'Oswald',sans-serif; color:#111;
}
.fin-bg {
  position:absolute; left:0; right:0; top:${mm(270)}; height:${mm(1040)};
  background-color:#fff; background-position:center 62%; background-size:cover; background-repeat:no-repeat;
}
.fin-bg-fade {
  position:absolute; left:0; right:0; top:${mm(270)}; height:${mm(1040)};
  background: linear-gradient(180deg,#fff 0%,rgba(255,255,255,.55) 18%,rgba(255,255,255,.15) 45%,rgba(255,255,255,.1) 80%,#fff 100%);
}
.fin-header { position:absolute; left:0; right:0; top:0; height:${mm(320)}; display:flex; align-items:center; justify-content:center; }
.fin-org-logo { max-width:${mm(380)}; max-height:${mm(300)}; object-fit:contain; }
.fin-sep { position:absolute; left:${mm(20)}; right:${mm(20)}; border-top:${mm(3)} dashed #111; }

.fin-title-block { position:absolute; left:0; right:0; top:${mm(340)}; display:flex; flex-direction:column; align-items:center; }
.fin-title-row { position:relative; width:100%; display:flex; justify-content:center; }
.fin-troph { position:absolute; top:${mm(10)}; width:${mm(90)}; height:${mm(90)}; }
.fin-troph-l { left:${mm(165)}; }
.fin-troph-r { right:${mm(165)}; }
.fin-title-main { font-family:'Anton',sans-serif; font-size:${mm(108)}; line-height:1; letter-spacing:${mm(1)}; }
.fin-title-sub { font-family:'Anton',sans-serif; font-size:${mm(84)}; line-height:1.05; letter-spacing:${mm(0.5)}; margin-top:${mm(6)}; }
.fin-date { font-family:'Archivo',sans-serif; font-weight:600; font-size:${mm(28)}; letter-spacing:${mm(1)}; margin-top:${mm(14)}; color:#333; }
.fin-price { margin-top:${mm(20)}; min-width:${mm(510)}; padding:0 ${mm(30)}; height:${mm(90)}; border-radius:${mm(12)}; background:#111; color:#fff; display:flex; align-items:center; justify-content:center; font-family:'Archivo',sans-serif; font-weight:900; font-size:${mm(66)}; letter-spacing:${mm(1)}; white-space:nowrap; }

.fin-matches { position:absolute; left:${mm(48)}; right:${mm(44)}; top:${mm(688)}; display:flex; flex-direction:column; gap:${mm(14)}; }
.fin-match-row { position:relative; height:${mm(72)}; border-radius:${mm(12)}; background:rgba(255,255,255,.93); box-shadow:0 1px 3px rgba(0,0,0,.25); display:grid; grid-template-columns:${mm(60)} minmax(0,1fr) ${mm(92)} minmax(0,1fr) ${mm(60)}; align-items:center; }
.fin-ball { justify-self:center; width:${mm(48)}; height:${mm(48)}; border-radius:50%; background:#fff url('/billet-finales/ballon.jpg') ${mm(-20)} ${mm(-43)}/${mm(125)} ${mm(125)} no-repeat; }
/* Team name text + QR code are hardcoded to the SAME physical size as the
   standard thermal tickets (lib/ticket-print-template.ts: teamsPt, qrMM) —
   not derived from the design canvas proportion — per explicit request that
   they match exactly rather than merely scale with the rest of the ticket. */
.fin-team { text-align:center; font-weight:700; font-size:9pt; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding:0 ${mm(6)}; }
.fin-vs { justify-self:center; width:${mm(88)}; height:${mm(62)}; background:#111; color:#fff; clip-path:polygon(22% 0,78% 0,100% 50%,78% 100%,22% 100%,0 50%); display:flex; align-items:center; justify-content:center; font-family:'Archivo',sans-serif; font-weight:900; font-size:${mm(30)}; }

.fin-venue { position:absolute; left:${mm(228)}; width:${mm(568)}; top:${mm(948)}; height:${mm(62)}; border-radius:${mm(12)}; background:#111; color:#fff; display:flex; align-items:center; justify-content:center; gap:${mm(22)}; }
.fin-venue span { font-weight:600; font-size:${mm(32)}; letter-spacing:${mm(0.5)}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

.fin-qr-box { position:absolute; left:calc(50% - 22mm); top:${mm(1024)}; width:44mm; height:44mm; border-radius:${mm(12)}; background:#fff; display:flex; align-items:center; justify-content:center; }
.fin-qr-box img { width:38mm; height:38mm; image-rendering:pixelated; }

.fin-issuer { position:absolute; left:0; right:0; top:197mm; text-align:center; font-family:'Archivo',sans-serif; }
.fin-ticket-id { font-weight:800; font-size:${mm(23)}; letter-spacing:${mm(0.5)}; }
.fin-issuer-line { font-weight:500; font-size:${mm(19)}; margin-top:${mm(6)}; }

.fin-norefund { position:absolute; left:0; right:0; top:214mm; text-align:center; font-family:'Archivo',sans-serif; font-weight:600; font-size:${mm(22)}; }
.fin-footer { position:absolute; left:0; right:0; top:220mm; height:${mm(100)}; display:flex; align-items:center; justify-content:center; gap:${mm(16)}; }
.fin-footer-line { width:${mm(84)}; border-top:${mm(2)} solid #111; }
.fin-ball-lg { width:${mm(80)}; height:${mm(80)}; border-radius:50%; background:#fff url('/billet-finales/ballon.jpg') ${mm(-34)} ${mm(-72)}/${mm(209)} ${mm(209)} no-repeat; }
.fin-bonmatch { font-family:'Anton',sans-serif; font-size:${mm(76)}; line-height:1; margin:0 ${mm(40)}; }
`;

function trunc(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

function renderBilleterieTicket(
  ticket: { serial_number: string; qr_token: string; created_at: string },
  bilName: string,
  price: number,
  matches: Array<{ home_team: string; away_team: string; match_date: string; home_team_zone?: string | null; away_team_zone?: string | null }>,
  sellerName: string,
  qrDataUrl: string,
  fmt: PrintFormat,
  showMatches: boolean
): string {
  const is58 = fmt === "58";
  const priceFmt = new Intl.NumberFormat("fr-FR").format(price);
  const createdAtFmt = format(new Date(ticket.created_at), "dd/MM/yyyy HH:mm", { locale: fr });

  const namePt = is58 ? "9" : "11";
  const matchPt = is58 ? "6" : "7";
  const logoFontPt = is58 ? "10" : "12";
  const prixStyle = `font-weight:900;font-size:${is58 ? "9" : "10"}pt;letter-spacing:0.5px;`;

  if (!showMatches) {
    return `
<div class="print-ticket">
<div class="c" style="font-weight:900;font-size:${logoFontPt}pt;letter-spacing:1px;padding:1mm 0;">Guichet Foot</div>
<div class="sep"></div>
<div class="c" style="font-size:${namePt}pt;font-weight:900;line-height:1.3;letter-spacing:0.5px;">${bilName}</div>
<div class="c tiny" style="font-style:italic;margin-top:0;">PASS MULTI-MATCHS</div>
<div class="c" style="${prixStyle}">${priceFmt}&nbsp;FCFA</div>
<div class="sep"></div>
<div class="c qr"><img src="${qrDataUrl}" alt="QR Code" /></div>
<div class="c small">${ticket.serial_number}</div>
<div class="c tiny">${sellerName} &middot; ${createdAtFmt}</div>
<div class="sep"></div>
<div class="c tiny">Non remboursable</div>
<div class="c bon-match">BON MATCH !</div>
</div>`;
  }

  // Date commune à tous les matchs (affichée une seule fois)
  const matchDateFmt = matches.length > 0
    ? format(new Date(matches[0].match_date), "dd/MM/yyyy", { locale: fr })
    : "";

  const matchLines = matches
    .map((m) => {
      const home = m.home_team_zone ? `${trunc(m.home_team, 12)} (${fmtZone(m.home_team_zone)})` : trunc(m.home_team, 14);
      const away = m.away_team_zone ? `${trunc(m.away_team, 12)} (${fmtZone(m.away_team_zone)})` : trunc(m.away_team, 14);
      return `${home} vs ${away}`;
    })
    .join("<br>");

  const passLine = matchDateFmt
    ? `PASS MULTI-MATCHS &middot; ${matchDateFmt}`
    : "PASS MULTI-MATCHS";

  return `
<div class="print-ticket">
<div class="c" style="font-weight:900;font-size:${logoFontPt}pt;letter-spacing:1px;padding:1mm 0;">Guichet Foot</div>
<div class="sep"></div>
<div class="c" style="font-size:${namePt}pt;font-weight:900;line-height:1.3;letter-spacing:0.5px;">${bilName}</div>
<div class="c tiny" style="font-style:italic;margin-top:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${passLine}</div>
<div class="c" style="${prixStyle}">${priceFmt}&nbsp;FCFA</div>
<div class="sep"></div>
<div class="c" style="font-size:${matchPt}pt;font-weight:600;line-height:1.3;">${matchLines}</div>
<div class="sep"></div>
<div class="c qr"><img src="${qrDataUrl}" alt="QR Code" /></div>
<div class="c small">${ticket.serial_number}</div>
<div class="c tiny">${sellerName} &middot; ${createdAtFmt}</div>
<div class="sep"></div>
<div class="c tiny">Valable pour les matchs indiqués &middot; Non remboursable</div>
<div class="c bon-match">BON MATCH !</div>
</div>`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get("batch");
  const fmt = (searchParams.get("fmt") === "58" ? "58" : "80") as PrintFormat;

  if (!batchId) return new NextResponse("batch requis", { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Non authentifié", { status: 401 });

  const adminClient = await createAdminClient();

  const tickets = await fetchAll<any>((from, to) =>
    adminClient
      .from("billeterie_tickets")
      .select("id, qr_token, serial_number, created_at, billeterie_id, sold_by, category_name, seller:profiles!billeterie_tickets_sold_by_fkey(full_name)")
      .eq("sale_batch_id", batchId)
      .order("serial_number")
      .range(from, to)
  );

  if (tickets.length === 0) return new NextResponse("Aucun billet trouvé", { status: 404 });

  // Get billeterie details (all tickets in batch share the same billeterie)
  const billeterieId = tickets[0].billeterie_id;
  const { data: bil } = await adminClient
    .from("billeterie")
    .select("name, price, match_ids, categories, show_matches_on_ticket, custom_design, organizer_logo_url, background_image_url, custom_date, custom_venue")
    .eq("id", billeterieId)
    .single();

  if (!bil) return new NextResponse("Billetterie introuvable", { status: 404 });

  // For multi-category billeteries, resolve price from category_name on the ticket
  const categoryName: string | null = (tickets[0] as any).category_name ?? null;
  const bilCategories: Array<{ name: string; price: number }> | null = bil.categories ?? null;
  const effectivePrice: number = (() => {
    if (bilCategories && categoryName) {
      const cat = bilCategories.find((c: { name: string; price: number }) => c.name === categoryName);
      if (cat) return cat.price;
    }
    return bil.price as number;
  })();

  const matchIds: string[] = bil.match_ids || [];
  const { data: matches } = matchIds.length > 0
    ? await adminClient.from("matches").select("id, home_team, away_team, match_date, home_team_zone, away_team_zone, venue").in("id", matchIds).order("match_date")
    : { data: [] as any[] };

  const sellerName = (tickets[0] as any).seller?.full_name || "—";

  // Displayed name: append category if multi-cat
  const displayName = categoryName ? `${bil.name} — ${categoryName}` : (bil.name as string);

  if ((bil as any).custom_design) {
    const priceLabel = `${new Intl.NumberFormat("fr-FR").format(effectivePrice)} FCFA`;
    const matchList = (matches || []).map((m: any) => ({
      home: m.home_team_zone ? `${m.home_team} (${fmtZone(m.home_team_zone)})` : m.home_team,
      away: m.away_team_zone ? `${m.away_team} (${fmtZone(m.away_team_zone)})` : m.away_team,
    }));
    const venue = (bil as any).custom_venue || null;
    const dateLabel = (bil as any).custom_date
      ? format(new Date(`${(bil as any).custom_date}T00:00:00`), "dd MMMM yyyy", { locale: fr })
      : null;
    const organizerLogoUrl = (bil as any).organizer_logo_url || "";
    const backgroundImageUrl = (bil as any).background_image_url || "";

    const finBlocks = await Promise.all(
      tickets.map(async (ticket: any) => {
        const qrDataUrl = await QRCode.toDataURL(`BIL-${ticket.qr_token}`, {
          width: 500, margin: 1, errorCorrectionLevel: "M",
          color: { dark: "#000000", light: "#FFFFFF" },
        });
        return renderFinalesTicket(ticket, displayName, dateLabel, priceLabel, matchList, venue, qrDataUrl, organizerLogoUrl, backgroundImageUrl);
      })
    );

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Billetterie — ${escapeHtml(bil.name as string)}</title>
<style>${FIN_CSS}</style>
</head>
<body>
${finBlocks.join("\n")}
<script>
window.onload = function() {
  setTimeout(function() { window.print(); }, 300);
  window.addEventListener('afterprint', function() { if (window.opener) window.close(); });
};
</script>
</body>
</html>`;

    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  const qrPx = fmt === "58" ? 180 : 220;

  const ticketBlocks = await Promise.all(
    tickets.map(async (ticket: any) => {
      const qrContent = `BIL-${ticket.qr_token}`;
      const qrDataUrl = await QRCode.toDataURL(qrContent, {
        width: qrPx,
        margin: 1,
        errorCorrectionLevel: "M",
        color: { dark: "#000000", light: "#FFFFFF" },
      });
      return renderBilleterieTicket(ticket, displayName, effectivePrice, matches || [], sellerName, qrDataUrl, fmt, bil.show_matches_on_ticket !== false);
    })
  );

  // Les billets sont des blocs directs dans <body> — le CSS gère les sauts de page
  const blocksHtml = ticketBlocks.join("\n");

  const totalPriceFmt = new Intl.NumberFormat("fr-FR").format(tickets.length * effectivePrice);

  // Surcharges CSS compactes propres aux billets billeterie (n'affecte pas les billets réguliers)
  const is58bck = fmt === "58";
  const bilCompactCss = `
  /* Compact billeterie overrides */
  .sep { margin: 0.4mm 0; }
  .qr { margin: 0.3mm auto 0.2mm; }
  .bon-match { margin-top: 0 !important; }
  .logo-wrap { height: ${is58bck ? "10mm" : "13mm"} !important; }
  .logo-img  { height: ${is58bck ? "17mm" : "22mm"} !important; }
  @page { size: ${is58bck ? "58mm 112mm" : "72mm 108mm"}; }
  @media print {
    .print-ticket {
      height:     ${is58bck ? "112mm" : "108mm"} !important;
      min-height: ${is58bck ? "112mm" : "108mm"} !important;
      max-height: ${is58bck ? "112mm" : "108mm"} !important;
      padding:    ${is58bck ? "1mm 1.5mm" : "1.5mm 2mm"} !important;
    }
  }`;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Billetterie — ${bil.name}</title>
<style>
${getPrintStyles(fmt)}
${bilCompactCss}
</style>
</head>
<body>
${blocksHtml}
<div class="no-print" style="padding:5mm 3mm;border-top:2px solid #000;text-align:center;margin-top:5mm;">
  <p style="font-size:11pt;font-weight:bold;margin-bottom:3mm;">
    ${tickets.length} billet(s) — ${totalPriceFmt} FCFA
  </p>
  <button onclick="window.print()" style="padding:2mm 8mm;font-size:11pt;cursor:pointer;font-weight:bold;">
    Imprimer tout
  </button>
</div>
<script>
window.onload = function() {
  setTimeout(function() { window.print(); }, 300);
  window.addEventListener('afterprint', function() { if (window.opener) window.close(); });
};
</script>
</body>
</html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

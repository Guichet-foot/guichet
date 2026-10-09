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
// 1024×1476 design canvas (matches the reference design in
// public/Billet Finales.html, minus the PASS MULTI-MATCHS bar), scaled down
// to a printable physical page via CSS transform.
const FIN_W = 1024;
const FIN_H = 1610;
const FIN_PAGE_MM_W = 105;
const FIN_PAGE_MM_H = (FIN_PAGE_MM_W * FIN_H) / FIN_W;
const FIN_SCALE = (FIN_PAGE_MM_W * (96 / 25.4)) / FIN_W;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderFinalesTicket(
  ticket: { serial_number: string; created_at: string },
  title: string,
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

  const bgUrl = backgroundImageUrl || "/billet-finales/stade-default.png";

  return `
<div class="fin-page">
  <div class="fin-ticket">
    <div class="fin-bg" style="background-image:url('${escapeHtml(bgUrl)}');"></div>
    <div class="fin-bg-fade"></div>

    <div class="fin-header">
      <div class="fin-gf-wrap"><img src="/billet-finales/gf-logo.png" alt="Guichet Foot" class="fin-gf-logo"></div>
      <div class="fin-divider"></div>
      ${organizerLogoUrl ? `<img src="${escapeHtml(organizerLogoUrl)}" alt="Organisateur" class="fin-org-logo">` : ""}
    </div>
    <div class="fin-sep" style="top:322px;"></div>

    <div class="fin-title-block">
      <div class="fin-title-row">
        <div class="fin-troph fin-troph-l"></div>
        <div class="fin-troph fin-troph-r"></div>
        <div class="fin-title-main">${titleMain}</div>
      </div>
      ${titleSub ? `<div class="fin-title-sub">${titleSub}</div>` : ""}
      <div class="fin-price">${escapeHtml(priceLabel)}</div>
    </div>

    ${matches.length > 0 ? `<div class="fin-matches">${matchRows}</div>` : ""}

    ${venueHtml}

    <div class="fin-qr-box"><img src="${qrDataUrl}" alt="QR"></div>
    <div class="fin-issuer">
      <div class="fin-ticket-id">${escapeHtml(ticket.serial_number)}</div>
      <div class="fin-issuer-line">${createdAtFmt}</div>
    </div>

    <div class="fin-sep" style="top:1442px;"></div>
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
* { margin:0; padding:0; box-sizing:border-box; }
body { background:#fff; }
.fin-page { width:${FIN_PAGE_MM_W}mm; height:${FIN_PAGE_MM_H}mm; overflow:hidden; position:relative; break-after: page; }
.fin-page:last-child { break-after: auto; }
.fin-ticket {
  position:relative; width:${FIN_W}px; height:${FIN_H}px;
  background:#fff; border:6px solid #111; overflow:hidden;
  font-family:'Oswald',sans-serif; color:#111;
  transform-origin: top left; transform: scale(${FIN_SCALE});
}
.fin-bg {
  position:absolute; left:0; right:0; top:270px; height:1040px;
  background-color:#fff; background-position:center 62%; background-size:cover; background-repeat:no-repeat;
  filter: grayscale(1) brightness(1.75) contrast(.85);
}
.fin-bg-fade {
  position:absolute; left:0; right:0; top:270px; height:1040px;
  background: linear-gradient(180deg,#fff 0%,rgba(255,255,255,.55) 18%,rgba(255,255,255,.15) 45%,rgba(255,255,255,.1) 80%,#fff 100%);
}
.fin-header { position:absolute; left:0; right:0; top:0; height:320px; display:flex; align-items:center; justify-content:center; gap:40px; }
.fin-gf-wrap { width:360px; height:220px; overflow:hidden; display:flex; justify-content:center; }
.fin-gf-logo { width:360px; height:540px; margin-top:-145px; flex:none; object-fit:contain; }
.fin-divider { width:3px; height:240px; background:#111; }
.fin-org-logo { max-width:300px; max-height:293px; object-fit:contain; }
.fin-sep { position:absolute; left:20px; right:20px; border-top:3px dashed #111; }

.fin-title-block { position:absolute; left:0; right:0; top:340px; display:flex; flex-direction:column; align-items:center; }
.fin-title-row { position:relative; width:100%; display:flex; justify-content:center; }
.fin-troph { position:absolute; top:6px; width:160px; height:107px; background-image:url('/billet-finales/trophy.png'); background-repeat:no-repeat; background-size:200% 100%; }
.fin-troph-l { left:84px; background-position:0 0; }
.fin-troph-r { right:84px; background-position:100% 0; }
.fin-title-main { font-family:'Anton',sans-serif; font-size:108px; line-height:1; letter-spacing:1px; }
.fin-title-sub { font-family:'Anton',sans-serif; font-size:84px; line-height:1.05; letter-spacing:.5px; margin-top:6px; }
.fin-price { margin-top:40px; min-width:510px; padding:0 30px; height:90px; border-radius:12px; background:#111; color:#fff; display:flex; align-items:center; justify-content:center; font-family:'Archivo',sans-serif; font-weight:900; font-size:66px; letter-spacing:1px; white-space:nowrap; }

.fin-matches { position:absolute; left:48px; right:44px; top:688px; display:flex; flex-direction:column; gap:14px; }
.fin-match-row { position:relative; height:72px; border-radius:12px; background:rgba(255,255,255,.93); box-shadow:0 1px 3px rgba(0,0,0,.25); display:grid; grid-template-columns:60px minmax(0,1fr) 92px minmax(0,1fr) 60px; align-items:center; }
.fin-ball { justify-self:center; width:48px; height:48px; border-radius:50%; background:#fff url('/billet-finales/ballon.jpg') -20px -43px/125px 125px no-repeat; }
.fin-team { text-align:center; font-weight:700; font-size:25px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding:0 6px; }
.fin-vs { justify-self:center; width:88px; height:62px; background:#111; color:#fff; clip-path:polygon(22% 0,78% 0,100% 50%,78% 100%,22% 100%,0 50%); display:flex; align-items:center; justify-content:center; font-family:'Archivo',sans-serif; font-weight:900; font-size:30px; }

.fin-venue { position:absolute; left:228px; width:568px; top:948px; height:62px; border-radius:12px; background:#111; color:#fff; display:flex; align-items:center; justify-content:center; gap:22px; }
.fin-venue span { font-weight:600; font-size:32px; letter-spacing:.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

.fin-qr-box { position:absolute; left:352px; top:1024px; width:320px; height:320px; border-radius:12px; background:#fff; display:flex; align-items:center; justify-content:center; }
.fin-qr-box img { width:270px; height:270px; image-rendering:pixelated; }

.fin-issuer { position:absolute; left:0; right:0; top:1374px; text-align:center; font-family:'Archivo',sans-serif; }
.fin-ticket-id { font-weight:800; font-size:23px; letter-spacing:.5px; }
.fin-issuer-line { font-weight:500; font-size:19px; margin-top:6px; }

.fin-norefund { position:absolute; left:0; right:0; top:1458px; text-align:center; font-family:'Archivo',sans-serif; font-weight:600; font-size:22px; }
.fin-footer { position:absolute; left:0; right:0; top:1484px; height:100px; display:flex; align-items:center; justify-content:center; gap:16px; }
.fin-footer-line { width:84px; border-top:2px solid #111; }
.fin-ball-lg { width:80px; height:80px; border-radius:50%; background:#fff url('/billet-finales/ballon.jpg') -34px -72px/209px 209px no-repeat; }
.fin-bonmatch { font-family:'Anton',sans-serif; font-size:76px; line-height:1; margin:0 40px; }
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
    .select("name, price, match_ids, categories, show_matches_on_ticket, custom_design, organizer_logo_url, background_image_url")
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
    const venue = (matches || []).find((m: any) => m.venue)?.venue ?? null;
    const organizerLogoUrl = (bil as any).organizer_logo_url || "";
    const backgroundImageUrl = (bil as any).background_image_url || "";

    const finBlocks = await Promise.all(
      tickets.map(async (ticket: any) => {
        const qrDataUrl = await QRCode.toDataURL(`BIL-${ticket.qr_token}`, {
          width: 416, margin: 1, errorCorrectionLevel: "M",
          color: { dark: "#000000", light: "#FFFFFF" },
        });
        return renderFinalesTicket(ticket, displayName, priceLabel, matchList, venue, qrDataUrl, organizerLogoUrl, backgroundImageUrl);
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

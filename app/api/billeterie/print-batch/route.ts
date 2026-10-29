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

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Truncate with ellipsis */
function trunc(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

// Inline vector ball icon for the custom-ticket match pill — not an <img>
// fetching a file, so it can't suffer the same load/decode failure that
// broke a real background photo on this printer 3 times. Drawn in black on
// a white disc so it stays legible against the pill's black background.
const BALL_SVG = `<svg viewBox="0 0 100 100" class="match-ball"><circle cx="50" cy="50" r="46" fill="#fff" stroke="#111" stroke-width="6"/><polygon points="50,28 68,41 61,62 39,62 32,41" fill="#111"/><path d="M50,28 L50,8 M68,41 L88,33 M61,62 L74,80 M39,62 L26,80 M32,41 L12,33" stroke="#111" stroke-width="6" fill="none" stroke-linecap="round"/></svg>`;

// Billets billeterie (standard ET "personnalisé") — un seul gabarit thermique
// 58/72-80mm, le même pour les deux. Le "Billet personnalisé" a eu plusieurs
// gabarits "affiche" séparés (145mm, avec photo plein cadre et/ou logos) —
// tous plus larges qu'un rouleau d'imprimante thermique. Confirmé sur
// plusieurs imprimantes/pilotes différents (Xprinter XP-80, XP-80C) : aucune
// n'expose d'option de papier au-delà de 80mm (72mm imprimable), donc un
// design de 145mm ne peut PHYSIQUEMENT pas s'imprimer correctement dessus —
// débordement, impression coupée, fond "cassé", texte flou, quel que soit le
// réglage choisi. La personnalisation se limite donc au(x) logo(s)
// (organisateur + équipes/partenaires, petites images simples, pas une photo
// plein cadre) + stade/date, posés sur le même gabarit que le billet
// standard — celui-ci imprime fiablement sur le même matériel.
function renderBilleterieTicket(
  ticket: { serial_number: string; qr_token: string; created_at: string },
  bilName: string,
  categoryName: string | null,
  price: number,
  matches: Array<{ home_team: string; away_team: string; match_date: string; home_team_zone?: string | null; away_team_zone?: string | null }>,
  sellerName: string,
  qrDataUrl: string,
  fmt: PrintFormat,
  showMatches: boolean,
  noteText: string | null,
  organizerLogoUrl: string | null,
  extraLogoUrls: string[],
  venue: string | null,
  dateLabel: string | null,
  isCustomDesign: boolean
): string {
  const is58 = fmt === "58";
  const priceFmt = new Intl.NumberFormat("fr-FR").format(price);
  const createdAtFmt = format(new Date(ticket.created_at), "dd/MM/yyyy HH:mm", { locale: fr });

  const namePt = is58 ? "9" : "11";
  const matchPt = is58 ? "6" : "7";
  const logoFontPt = is58 ? "10" : "12";
  const notePt = is58 ? "7" : "8";
  const prixStyle = `font-weight:900;font-size:${is58 ? "9" : "10"}pt;letter-spacing:0.5px;`;
  const noteHtml = noteText
    ? `<div class="c" style="font-weight:800;font-size:${notePt}pt;color:#b91c1c;margin-top:0.5mm;">${escapeHtml(noteText)}</div>`
    : "";

  // Standard ticket: category stays in the title (unchanged). Custom ticket:
  // category moves to the price line instead ("Entrée 500 FCFA") so the
  // title stays just the pass name, as requested.
  const titleText = !isCustomDesign && categoryName ? `${bilName} — ${categoryName}` : bilName;
  const priceLabel = isCustomDesign && categoryName
    ? `${escapeHtml(categoryName)} ${priceFmt}&nbsp;FCFA`
    : `${priceFmt}&nbsp;FCFA`;
  const priceHtml = isCustomDesign
    ? `<div class="c"><span class="price-pill">${priceLabel}</span></div>`
    : `<div class="c" style="${prixStyle}">${priceLabel}</div>`;

  const logoUrls = [organizerLogoUrl, ...extraLogoUrls].filter((u): u is string => !!u);
  const headerHtml = logoUrls.length > 0
    ? `<div class="c" style="padding:1mm 0;display:flex;align-items:center;justify-content:center;gap:1.5mm;flex-wrap:wrap;">${logoUrls.map((u) => `<img src="${escapeHtml(u)}" alt="Logo" class="org-logo">`).join("")}</div>`
    : `<div class="c" style="font-weight:900;font-size:${logoFontPt}pt;letter-spacing:1px;padding:1mm 0;">Guichet Foot</div>`;

  const venueDateParts = [venue, dateLabel].filter((v): v is string => !!v).map((v) => v.toUpperCase());
  const venueDateHtml = venueDateParts.length > 0
    ? `<div class="c tiny" style="font-weight:700;margin-top:0.5mm;">${escapeHtml(venueDateParts.join(" · "))}</div>`
    : "";
  // The "PASS MULTI-MATCHS · date" line is the only date indicator on a
  // standard ticket, but it's redundant once the venue/date line above is
  // already showing the same date on a custom ticket.
  const showPassLine = venueDateParts.length === 0;
  const ticketClass = isCustomDesign ? "print-ticket custom-ticket" : "print-ticket";

  if (!showMatches) {
    return `
<div class="${ticketClass}">
${headerHtml}
<div class="sep"></div>
<div class="c" style="font-size:${namePt}pt;font-weight:900;line-height:1.3;letter-spacing:0.5px;">${titleText}</div>
${noteHtml}
${venueDateHtml}
${showPassLine ? `<div class="c tiny" style="font-style:italic;margin-top:0;">PASS MULTI-MATCHS</div>` : ""}
${priceHtml}
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

  // Custom ticket: each match gets its own black pill with a ball icon
  // between the two teams, instead of a plain "home vs away" text line.
  const matchesHtml = isCustomDesign
    ? matches
        .map((m) => {
          const home = m.home_team_zone ? `${trunc(m.home_team, 10)} (${fmtZone(m.home_team_zone)})` : trunc(m.home_team, 12);
          const away = m.away_team_zone ? `${trunc(m.away_team, 10)} (${fmtZone(m.away_team_zone)})` : trunc(m.away_team, 12);
          return `<div class="c"><div class="match-pill"><span class="match-team">${home}</span>${BALL_SVG}<span class="match-team">${away}</span></div></div>`;
        })
        .join("")
    : `<div class="c" style="font-size:${matchPt}pt;font-weight:600;line-height:1.3;">${matchLines}</div>`;

  const passLine = matchDateFmt
    ? `PASS MULTI-MATCHS &middot; ${matchDateFmt}`
    : "PASS MULTI-MATCHS";

  return `
<div class="${ticketClass}">
${headerHtml}
<div class="sep"></div>
<div class="c" style="font-size:${namePt}pt;font-weight:900;line-height:1.3;letter-spacing:0.5px;">${titleText}</div>
${noteHtml}
${venueDateHtml}
${showPassLine ? `<div class="c tiny" style="font-style:italic;margin-top:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${passLine}</div>` : ""}
${priceHtml}
<div class="sep"></div>
${matchesHtml}
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
    .select("name, price, match_ids, categories, show_matches_on_ticket, custom_design, organizer_logo_url, extra_logo_urls, custom_date, custom_venue, note_text")
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

  const noteText: string | null = (bil as any).note_text || null;
  const isCustom = (bil as any).custom_design === true;
  const organizerLogoUrl = isCustom ? ((bil as any).organizer_logo_url || null) : null;
  const extraLogoUrls: string[] = isCustom ? ((bil as any).extra_logo_urls || []) : [];
  const venue = isCustom ? ((bil as any).custom_venue || null) : null;
  const dateLabel = isCustom && (bil as any).custom_date
    ? format(new Date(`${(bil as any).custom_date}T00:00:00`), "dd MMMM yyyy", { locale: fr })
    : null;

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
      return renderBilleterieTicket(ticket, bil.name as string, categoryName, effectivePrice, matches || [], sellerName, qrDataUrl, fmt, bil.show_matches_on_ticket !== false, noteText, organizerLogoUrl, extraLogoUrls, venue, dateLabel, isCustom);
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
  .org-logo  { max-height: ${is58bck ? "10mm" : "13mm"}; max-width: ${is58bck ? "16mm" : "20mm"}; object-fit: contain; }
  /* Visual differentiation for "billet personnalisé" vs the plain standard
     ticket — a CSS-only diagonal hairline pattern + border, not an image.
     An external photo was tried 3 times on this exact printer and corrupted
     every time (see route.ts comment above); a pattern drawn by the browser
     itself at print time can't suffer the same fetch/decode failure, and
     thermal heads reproduce sparse hairlines far more reliably than a
     continuous-tone photo. print-color-adjust is required or Chrome drops
     background graphics by default when printing.
  */
  .custom-ticket {
    border: 0.5mm solid #111 !important;
    background-image: repeating-linear-gradient(45deg, rgba(0,0,0,0.12) 0, rgba(0,0,0,0.12) 0.3mm, transparent 0.3mm, transparent 3mm);
    -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;
  }
  /* Price badge and per-match pill (custom ticket only) — same solid-black
     pill language as the logo row's card look, all plain CSS shapes/fills
     so they print exactly like any other filled rectangle/border already
     used on the standard ticket, nothing photographic. */
  .price-pill {
    display: inline-block; background: #111; color: #fff; font-weight: 900;
    font-size: ${is58bck ? "9" : "10"}pt; letter-spacing: 0.5px;
    padding: 0.8mm 4mm; border-radius: 4mm; margin: 0.5mm 0;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;
  }
  .match-pill {
    display: flex; align-items: center; justify-content: center; gap: 1.5mm;
    background: #111; color: #fff; font-weight: 800;
    font-size: ${is58bck ? "7" : "8"}pt; letter-spacing: 0.3px;
    padding: 1mm 2.5mm; border-radius: 5mm; margin: 0.6mm auto; max-width: 96%;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;
  }
  .match-team { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .match-ball { width: ${is58bck ? "2.6mm" : "3.2mm"}; height: ${is58bck ? "2.6mm" : "3.2mm"}; flex-shrink: 0; }
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

export type PrintFormat = "58" | "80";

/** Truncate with ellipsis */
function trunc(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

export function getPrintStyles(fmt: PrintFormat): string {
  const is58 = fmt === "58";

  // 72mm = printable area of an 80mm thermal roll (XP-80T and similar)
  const width    = is58 ? "58mm"  : "72mm";
  const padV     = is58 ? "1.5mm" : "2mm";
  const padH     = is58 ? "1.5mm" : "2mm";
  const basePt   = is58 ? "7.5"   : "8.5";
  const teamsPt  = is58 ? "9"     : "8";
  const vsPt     = is58 ? "6.5"   : "7";
  const infoPt   = is58 ? "7"     : "8";
  const catPt    = is58 ? "11"    : "13";
  const smallPt  = is58 ? "6.5"   : "7.5";
  const tinyPt   = is58 ? "6"     : "6.5";
  const bonPt    = is58 ? "8"     : "9";
  const qrMM     = is58 ? "30"    : "38";

  /* Logo crop: image is displayed taller than the container so
     overflow:hidden clips the whitespace top/bottom symmetrically. */
  const logoContH = is58 ? "12mm"  : "16mm";
  const logoImgH  = is58 ? "20mm"  : "27mm";

  return `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: ${width};
    font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;
    font-size: ${basePt}pt;
    color: #000;
    background: #fff;
    line-height: 1.25;
  }
  .c { text-align: center; }
  .sep { border-top: 1px dashed #000; margin: 1mm 0; }
  .logo-wrap {
    overflow: hidden;
    height: ${logoContH};
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .logo-img {
    height: ${logoImgH};
    width: auto;
    max-width: 98%;
  }
  .teams {
    font-size: ${teamsPt}pt;
    font-weight: 900;
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .vs { font-size: ${vsPt}pt; font-weight: 400; }
  .info {
    font-size: ${infoPt}pt;
    font-weight: 600;
    line-height: 1.35;
  }
  .cat-prix {
    font-size: ${catPt}pt;
    font-weight: 900;
    line-height: 1.2;
  }
  .qr { margin: 1.5mm auto 0.5mm; }
  .qr img {
    width: ${qrMM}mm; height: ${qrMM}mm;
    display: block; margin: 0 auto;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }
  .small {
    font-size: ${smallPt}pt;
    font-family: 'Courier New', monospace;
    font-weight: bold;
    line-height: 1.35;
  }
  .tiny { font-size: ${tinyPt}pt; font-weight: 600; line-height: 1.3; }
  .bon-match { font-size: ${bonPt}pt; font-weight: 900; letter-spacing: 1.5px; margin-top: 0.5mm; }

  @page {
    size: ${width} auto;
    margin: 0;
  }

  @media print {
    html,
    body {
      width: ${width};
      margin: 0 !important;
      padding: 0 !important;
      height: auto !important;
      min-height: 0 !important;
      overflow: visible !important;
    }
    .print-ticket {
      width: ${width} !important;
      height: auto !important;
      min-height: 0 !important;
      max-height: none !important;
      overflow: visible !important;
      padding: ${padV} ${padH} !important;
      margin: 0 !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .no-print {
      display: none !important;
    }
  }

  @media screen {
    body { max-width: ${width}; margin: 10px auto; border: 1px solid #ccc; }
    .print-ticket { padding: ${padV} ${padH}; }
    .ticket-wrap { border: 1px solid #ddd; margin-bottom: 12px; }
    .no-print { display: block !important; }
  }`;
}

export function renderTicketBlock(
  ticket: {
    serial_number: string;
    price: number;
    match: {
      home_team: string;
      away_team: string;
      venue: string;
      home_team_zone?: string | null;
      away_team_zone?: string | null;
      match_type?: string | null;
    };
    category: { name: string };
    seller: { full_name: string };
  },
  qrDataUrl: string,
  matchDateFmt: string,
  soldAtFmt: string,
  fmt: PrintFormat,
  logoDataUrl: string
): string {
  const is58 = fmt === "58";
  const priceFmt = new Intl.NumberFormat("fr-FR").format(ticket.price);
  const home = ticket.match.home_team;
  const away = ticket.match.away_team;
  const homeZone = ticket.match.home_team_zone || null;
  const awayZone = ticket.match.away_team_zone || null;
  const matchType = ticket.match.match_type || null;

  const homeDisplay = homeZone ? `${home} (${homeZone})` : home;
  const awayDisplay = awayZone ? `${away} (${awayZone})` : away;

  /* 80mm: one line, 58mm: two lines */
  const teamsHtml = is58
    ? `<div class="c teams">${trunc(homeDisplay, 24)}<br><span class="vs">vs</span><br>${trunc(awayDisplay, 24)}</div>`
    : `<div class="c teams">${trunc(homeDisplay, 18)} <span class="vs">vs</span> ${trunc(awayDisplay, 18)}</div>`;

  const matchTypeHtml = matchType
    ? `<div class="c tiny" style="font-style:italic;margin-top:0.5mm;">${matchType}</div>`
    : "";

  return `
<div class="print-ticket">
<div class="logo-wrap c">
  <img src="${logoDataUrl}" class="logo-img" alt="Guichet Foot" />
</div>
<div class="sep"></div>
${teamsHtml}
<div class="c info">${ticket.match.venue}</div>
${matchTypeHtml}
<div class="sep"></div>
<div class="c cat-prix">${ticket.category.name} &mdash; ${priceFmt}&nbsp;FCFA</div>
<div class="sep"></div>
<div class="c qr"><img src="${qrDataUrl}" alt="QR Code" /></div>
<div class="c small">${ticket.serial_number}</div>
<div class="c tiny">${ticket.seller.full_name} &middot; ${soldAtFmt}</div>
<div class="sep"></div>
<div class="c tiny">Valable uniquement ce match &middot; Non remboursable</div>
<div class="c bon-match">BON MATCH !</div>
</div>`;
}

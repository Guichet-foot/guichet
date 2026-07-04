export type PrintFormat = "58" | "80";

/** Truncate with ellipsis */
function trunc(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

export function getPrintStyles(fmt: PrintFormat): string {
  const is58 = fmt === "58";

  const width    = is58 ? "58mm"  : "80mm";
  const padV     = is58 ? "1.5mm" : "2mm";
  const padH     = is58 ? "1.5mm" : "2mm";
  const basePt   = is58 ? "7.5"   : "8.5";
  const teamsPt  = is58 ? "10"    : "12";
  const vsPt     = is58 ? "6.5"   : "7";
  const infoPt   = is58 ? "7"     : "8";
  const catPt    = is58 ? "11"    : "13";
  const smallPt  = is58 ? "6.5"   : "7.5";
  const tinyPt   = is58 ? "6"     : "6.5";
  const bonPt    = is58 ? "8"     : "9";
  const qrMM     = is58 ? "20"    : "24";

  /* Logo crop: image is displayed taller than the container so
     overflow:hidden clips the whitespace top/bottom symmetrically. */
  const logoContH = is58 ? "7mm"   : "9mm";
  const logoImgH  = is58 ? "12mm"  : "15mm";

  return `
  @page { size: ${width} auto; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: ${width};
    font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;
    font-size: ${basePt}pt;
    color: #000;
    background: #fff;
    line-height: 1.25;
  }
  body { padding: ${padV} ${padH}; }
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
  }
  .vs { font-size: ${vsPt}pt; font-weight: 400; opacity: 0.5; }
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
  .qr img { width: ${qrMM}mm; height: ${qrMM}mm; display: block; margin: 0 auto; }
  .small {
    font-size: ${smallPt}pt;
    font-family: 'Courier New', monospace;
    font-weight: bold;
    line-height: 1.35;
  }
  .tiny { font-size: ${tinyPt}pt; font-weight: 600; line-height: 1.3; }
  .bon-match { font-size: ${bonPt}pt; font-weight: 900; letter-spacing: 1.5px; margin-top: 0.5mm; }
  .no-print { display: none; }
  @media print {
    html, body { width: ${width}; margin: 0; padding: ${padV} ${padH}; }
    .no-print { display: none !important; }
  }
  @media screen {
    body { max-width: ${width}; margin: 10px auto; border: 1px solid #ccc; padding: ${padV} ${padH}; }
    .ticket-wrap { border: 1px solid #ddd; margin-bottom: 12px; }
    .no-print { display: block !important; }
  }`;
}

export function renderTicketBlock(
  ticket: {
    serial_number: string;
    price: number;
    match: { home_team: string; away_team: string; venue: string };
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

  /* 80mm: one line, truncate each team name to 14 chars
     58mm: two lines, truncate each team name to 20 chars  */
  const teamsHtml = is58
    ? `<div class="c teams">${trunc(home, 20)}<br><span class="vs">vs</span><br>${trunc(away, 20)}</div>`
    : `<div class="c teams">${trunc(home, 14)} <span class="vs">vs</span> ${trunc(away, 14)}</div>`;

  return `
<div class="logo-wrap c">
  <img src="${logoDataUrl}" class="logo-img" alt="Guichet Foot" />
</div>
<div class="sep"></div>
${teamsHtml}
<div class="c info">${ticket.match.venue}<br>${matchDateFmt}</div>
<div class="sep"></div>
<div class="c cat-prix">${ticket.category.name} &mdash; ${priceFmt}&nbsp;FCFA</div>
<div class="sep"></div>
<div class="c qr"><img src="${qrDataUrl}" alt="QR Code" /></div>
<div class="c small">${ticket.serial_number}</div>
<div class="c tiny">${ticket.seller.full_name} &middot; ${soldAtFmt}</div>
<div class="sep"></div>
<div class="c tiny">Valable uniquement ce match &middot; Non remboursable</div>
<div class="c bon-match">BON MATCH !</div>`;
}

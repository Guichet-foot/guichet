export type PrintFormat = "58" | "80";

export function getPrintStyles(fmt: PrintFormat): string {
  const is58 = fmt === "58";

  const width      = is58 ? "58mm" : "80mm";
  const padV       = is58 ? "2mm"  : "3mm";
  const padH       = is58 ? "2mm"  : "3mm";
  const basePt     = is58 ? "9"    : "10";
  const logoPt     = is58 ? "11"   : "13";
  const teamsPt    = is58 ? "13"   : "15";
  const vsPt       = is58 ? "8"    : "9";
  const infoPt     = is58 ? "8"    : "9";
  const catPt      = is58 ? "15"   : "18";
  const prixPt     = is58 ? "14"   : "17";
  const qrMM       = is58 ? "23"   : "30";
  const smallPt    = is58 ? "7.5"  : "8.5";
  const tinyPt     = is58 ? "6.5"  : "7.5";

  return `
  @page { size: ${width} auto; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: ${width};
    font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;
    font-size: ${basePt}pt;
    font-weight: normal;
    color: #000;
    background: #fff;
    line-height: 1.3;
  }
  body { padding: ${padV} ${padH}; }
  .c { text-align: center; }
  .sep { border-top: 1.5px dashed #000; margin: 2mm 0; }
  .logo {
    font-size: ${logoPt}pt;
    font-weight: 900;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .teams {
    font-size: ${teamsPt}pt;
    font-weight: 900;
    line-height: 1.35;
  }
  .vs {
    font-size: ${vsPt}pt;
    font-weight: 400;
    opacity: 0.6;
  }
  .info {
    font-size: ${infoPt}pt;
    line-height: 1.4;
    font-weight: 600;
  }
  .cat-line {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 4px;
    flex-wrap: wrap;
    padding: 1mm 0;
  }
  .cat {
    font-size: ${catPt}pt;
    font-weight: 900;
    display: block;
  }
  .prix {
    font-size: ${prixPt}pt;
    font-weight: 900;
    display: block;
  }
  .qr { margin: 2mm auto 1mm; }
  .qr img { width: ${qrMM}mm; height: ${qrMM}mm; display: block; margin: 0 auto; }
  .small {
    font-size: ${smallPt}pt;
    font-family: 'Courier New', monospace;
    line-height: 1.4;
    font-weight: bold;
  }
  .tiny {
    font-size: ${tinyPt}pt;
    line-height: 1.4;
    font-weight: 600;
  }
  .no-print { display: none; }
  @media print {
    html, body { width: ${width}; margin: 0; padding: ${padV} ${padH}; }
    .no-print { display: none !important; }
  }
  @media screen {
    body { max-width: ${width}; margin: 10px auto; border: 1px solid #ccc; }
    .ticket-wrap { border: 1px solid #ccc; margin-bottom: 10px; }
    .no-print { display: block !important; }
  }`;
}

export function renderTicketBlock(ticket: {
  serial_number: string;
  qr_token: string;
  price: number;
  sold_at: string;
  match: { home_team: string; away_team: string; venue: string; match_date: string };
  category: { name: string };
  seller: { full_name: string };
}, qrDataUrl: string, matchDateFmt: string, soldAtFmt: string): string {
  const priceFmt = new Intl.NumberFormat("fr-FR").format(ticket.price);

  return `
  <div class="c logo">GUICHET FOOT</div>
  <div class="sep"></div>
  <div class="c teams">${ticket.match.home_team}<br><span class="vs">vs</span><br>${ticket.match.away_team}</div>
  <div class="sep"></div>
  <div class="c info">${ticket.match.venue}<br>${matchDateFmt}</div>
  <div class="sep"></div>
  <div class="c cat">${ticket.category.name}</div>
  <div class="c prix">${priceFmt} FCFA</div>
  <div class="sep"></div>
  <div class="c qr"><img src="${qrDataUrl}" alt="QR Code"/></div>
  <div class="c small">${ticket.serial_number}</div>
  <div class="c tiny">${ticket.seller.full_name} · ${soldAtFmt}</div>
  <div class="sep"></div>
  <div class="c tiny">Valable uniquement ce match · Non remboursable</div>`;
}

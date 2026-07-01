import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import QRCode from "qrcode";

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get("batch");

  if (!batchId) {
    return new NextResponse("batch requis", { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Non authentifié", { status: 401 });

  const { data: tickets } = await supabase
    .from("tickets")
    .select("*, match:matches(home_team, away_team, venue, match_date), category:ticket_categories(name), seller:profiles!tickets_sold_by_fkey(full_name)")
    .eq("sale_batch_id", batchId)
    .order("serial_number");

  if (!tickets || tickets.length === 0) {
    return new NextResponse("Aucun billet trouvé", { status: 404 });
  }

  // Générer les blocs HTML pour chaque billet
  const ticketBlocks = await Promise.all(
    tickets.map(async (ticket: any) => {
      const qrDataUrl = await QRCode.toDataURL(ticket.qr_token, {
        width: 160, margin: 0,
        color: { dark: "#000000", light: "#FFFFFF" },
      });

      const matchDate = format(new Date(ticket.match.match_date), "EEE d MMM yyyy — HH'h'mm", { locale: fr });
      const soldAt = format(new Date(ticket.sold_at), "dd/MM HH:mm", { locale: fr });
      const priceFmt = new Intl.NumberFormat("fr-FR").format(ticket.price);

      return `
<div class="ticket">
  <div class="c logo">GUICHET FOOT</div>
  <div class="sep"></div>
  <div class="c teams">${ticket.match.home_team}<br><span class="vs">vs</span><br>${ticket.match.away_team}</div>
  <div class="c info">${ticket.match.venue} — ${matchDate}</div>
  <div class="sep"></div>
  <div class="c"><span class="cat">${ticket.category.name}</span> — <span class="prix">${priceFmt} FCFA</span></div>
  <div class="sep"></div>
  <div class="c qr"><img src="${qrDataUrl}" alt="QR"/></div>
  <div class="c small">${ticket.serial_number} — ${ticket.seller.full_name} — ${soldAt}</div>
  <div class="sep"></div>
  <div class="c tiny">Valable uniquement ce match — Non remboursable</div>
</div>`;
    })
  );

  const totalPriceFmt = new Intl.NumberFormat("fr-FR").format(tickets.reduce((s: number, t: any) => s + t.price, 0));

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Billets — ${tickets[0].match.home_team} vs ${tickets[0].match.away_team}</title>
<style>
  @page { size: 72mm auto; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 72mm;
    font-family: 'Courier New', monospace;
    font-size: 9pt;
    color: #000;
    background: #fff;
    line-height: 1.2;
  }
  .ticket {
    width: 72mm;
    padding: 2mm 3mm;
    page-break-after: always;
  }
  .ticket:last-child { page-break-after: auto; }
  .c { text-align: center; }
  .sep { border-top: 1px dashed #000; margin: 1.5mm 0; }
  .logo { font-size: 12pt; font-weight: bold; letter-spacing: 1px; }
  .teams { font-size: 11pt; font-weight: bold; line-height: 1.3; }
  .vs { font-size: 8pt; font-weight: normal; color: #555; }
  .info { font-size: 8pt; line-height: 1.3; }
  .cat { font-size: 14pt; font-weight: bold; }
  .prix { font-size: 12pt; font-weight: bold; }
  .qr { margin: 1.5mm auto; }
  .qr img { width: 28mm; height: 28mm; }
  .small { font-size: 7pt; }
  .tiny { font-size: 6pt; color: #666; }
  .no-print { display: none; }
  @media print {
    html, body { width: 72mm; margin: 0; padding: 0; }
    .no-print { display: none !important; }
  }
  @media screen {
    body { max-width: 72mm; margin: 10px auto; }
    .ticket { border: 1px solid #ccc; margin-bottom: 10px; }
    .no-print { display: block !important; }
  }
</style>
</head>
<body>
${ticketBlocks.join("\n")}

<div class="no-print" style="padding:5mm 3mm; border-top:2px solid #000; text-align:center;">
  <p style="font-size:10pt; font-weight:bold; margin-bottom:3mm;">
    ${tickets.length} billet(s) — ${totalPriceFmt} FCFA
  </p>
  <button onclick="window.print()" style="padding:2mm 6mm; font-size:11pt; cursor:pointer; font-weight:bold;">
    Imprimer tout
  </button>
</div>

<script>
window.onload = function() {
  setTimeout(function() { window.print(); }, 300);
};
</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

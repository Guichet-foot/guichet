import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import QRCode from "qrcode";
import { getPrintStyles, renderTicketBlock, type PrintFormat } from "@/lib/ticket-print-template";

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get("batch");
  const fmt = (searchParams.get("fmt") === "58" ? "58" : "80") as PrintFormat;

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

  const qrSize = fmt === "58" ? 140 : 180;

  const ticketBlocks = await Promise.all(
    tickets.map(async (ticket: any) => {
      const qrDataUrl = await QRCode.toDataURL(ticket.qr_token, {
        width: qrSize,
        margin: 0,
        color: { dark: "#000000", light: "#FFFFFF" },
      });

      const matchDateFmt = format(new Date(ticket.match.match_date), "EEE d MMM yyyy — HH'h'mm", { locale: fr });
      const soldAtFmt = format(new Date(ticket.sold_at), "dd/MM/yyyy HH:mm", { locale: fr });
      const block = renderTicketBlock(ticket, qrDataUrl, matchDateFmt, soldAtFmt);

      return `<div class="ticket-wrap">${block}</div>`;
    })
  );

  const totalPriceFmt = new Intl.NumberFormat("fr-FR").format(
    tickets.reduce((s: number, t: any) => s + t.price, 0)
  );

  // Break between tickets: page-break on all except the last
  const ticketSep = fmt === "58"
    ? `<div style="break-after:page;page-break-after:always;"></div>`
    : `<div style="break-after:page;page-break-after:always;"></div>`;

  const blocksHtml = ticketBlocks
    .map((b, i) => (i < ticketBlocks.length - 1 ? b + ticketSep : b))
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Billets — ${tickets[0].match.home_team} vs ${tickets[0].match.away_team}</title>
<style>
${getPrintStyles(fmt)}
.ticket-wrap { padding: 0; }
@media print {
  .ticket-wrap { page-break-inside: avoid; }
}
</style>
</head>
<body>
${blocksHtml}
<div class="no-print" style="padding:5mm 3mm;border-top:2px solid #000;text-align:center;margin-top:5mm;">
  <p style="font-size:11pt;font-weight:bold;margin-bottom:3mm;">
    ${tickets.length} billet(s) — ${totalPriceFmt} FCFA
  </p>
  <button onclick="window.print()" style="padding:2mm 6mm;font-size:11pt;cursor:pointer;font-weight:bold;">
    Imprimer tout
  </button>
</div>
<script>
window.onload = function() { setTimeout(function() { window.print(); }, 300); };
</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

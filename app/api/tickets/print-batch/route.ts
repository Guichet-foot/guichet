import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import QRCode from "qrcode";
import { readFileSync } from "fs";
import { join } from "path";
import { getPrintStyles, renderTicketBlock, type PrintFormat } from "@/lib/ticket-print-template";

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get("batch");
  const fmt = (searchParams.get("fmt") === "58" ? "58" : "80") as PrintFormat;

  if (!batchId) return new NextResponse("batch requis", { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Non authentifié", { status: 401 });

  // adminClient bypasses RLS — needed for C3 accounts where matches have zone_id=null
  const adminClient = await createAdminClient();
  const { data: tickets } = await adminClient
    .from("tickets")
    .select("*, match:matches(home_team, away_team, venue, match_date, home_team_zone, away_team_zone, match_type), category:ticket_categories(name), seller:profiles!tickets_sold_by_fkey(full_name)")
    .eq("sale_batch_id", batchId)
    .order("serial_number");

  if (!tickets || tickets.length === 0) return new NextResponse("Aucun billet trouvé", { status: 404 });

  /* Logo: embed as base64 once for all tickets */
  const logoBase64 = readFileSync(join(process.cwd(), "public", "logoticket.png")).toString("base64");
  const logoDataUrl = `data:image/png;base64,${logoBase64}`;

  const qrPx = fmt === "58" ? 300 : 380;

  const ticketBlocks = await Promise.all(
    tickets.map(async (ticket: any) => {
      const qrDataUrl = await QRCode.toDataURL(ticket.qr_token, {
        width: qrPx,
        margin: 2,
        errorCorrectionLevel: "M",
        color: { dark: "#000000", light: "#FFFFFF" },
      });
      const matchDateFmt = format(new Date(ticket.match.match_date), "EEE d MMM yyyy — HH'h'mm", { locale: fr });
      const soldAtFmt    = format(new Date(ticket.sold_at), "dd/MM/yyyy HH:mm", { locale: fr });
      return renderTicketBlock(ticket, qrDataUrl, matchDateFmt, soldAtFmt, fmt, logoDataUrl);
    })
  );

  const totalPriceFmt = new Intl.NumberFormat("fr-FR").format(
    tickets.reduce((s: number, t: any) => s + t.price, 0)
  );

  /* Inject a page-break div between tickets (never after the last one) */
  const pageBreak = `<div style="break-after:page;page-break-after:always;height:0;"></div>`;
  const blocksHtml = ticketBlocks
    .map((b, i) => (i < ticketBlocks.length - 1 ? `<div class="ticket-wrap">${b}</div>${pageBreak}` : `<div class="ticket-wrap">${b}</div>`))
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="fr" style="margin:0;padding:0;">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Billets — ${tickets[0].match.home_team} vs ${tickets[0].match.away_team}</title>
<style>
${getPrintStyles(fmt)}
.ticket-wrap { page-break-inside: avoid; }
</style>
</head>
<body style="margin:0;padding:0;">
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
  var tickets = document.querySelectorAll('.print-ticket');
  var pageW = '${fmt === "58" ? "58mm" : "72mm"}';
  if (tickets.length > 0) {
    var maxH = 0;
    var firstTop = tickets[0].getBoundingClientRect().top;
    tickets.forEach(function(t) {
      var h = t.getBoundingClientRect().height;
      if (h > maxH) maxH = h;
    });
    var hMm = Math.ceil(maxH * 25.4 / 96) + 3;
    // Measure top offset: any space above the first ticket
    var topOffsetMm = Math.ceil(firstTop * 25.4 / 96);
    // Negative margin-top cancels the hardware top margin the XPRINTER driver adds.
    var topMarginMm = topOffsetMm > 0 ? -topOffsetMm : 0;
    var s = document.createElement('style');
    s.textContent = '@page { size: ' + pageW + ' ' + hMm + 'mm; margin-top: ' + topMarginMm + 'mm; margin-right: 0mm; margin-bottom: 0mm; margin-left: 0mm; }';
    document.head.appendChild(s);
  }
  setTimeout(function() { window.print(); }, 500);
  window.addEventListener('afterprint', function() {
    if (window.opener) window.close();
  });
};
</script>
</body>
</html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

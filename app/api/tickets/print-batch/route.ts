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
    .select("*, match:matches(home_team, away_team, venue, match_date), category:ticket_categories(name), seller:profiles!tickets_sold_by_fkey(full_name)")
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
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Billets — ${tickets[0].match.home_team} vs ${tickets[0].match.away_team}</title>
<style>
${getPrintStyles(fmt)}
.ticket-wrap { page-break-inside: avoid; }
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
window.onload = function() { setTimeout(function() { window.print(); }, 400); };
</script>
</body>
</html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

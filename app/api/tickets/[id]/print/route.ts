import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import QRCode from "qrcode";
import { readFileSync } from "fs";
import { join } from "path";
import { getPrintStyles, renderTicketBlock, type PrintFormat } from "@/lib/ticket-print-template";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const fmt = (searchParams.get("fmt") === "58" ? "58" : "80") as PrintFormat;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Non authentifié", { status: 401 });

  // adminClient bypasses RLS — needed for C3 accounts where matches have zone_id=null
  const adminClient = await createAdminClient();
  const { data: ticket } = await adminClient
    .from("tickets")
    .select("*, match:matches(home_team, away_team, venue, match_date, home_team_zone, away_team_zone, match_type), category:ticket_categories(name), seller:profiles!tickets_sold_by_fkey(full_name)")
    .eq("id", id)
    .single();

  if (!ticket) return new NextResponse("Billet introuvable", { status: 404 });

  /* Logo: embed as base64 so it works in any print context (no external HTTP) */
  const logoBase64 = readFileSync(join(process.cwd(), "public", "logoticket.png")).toString("base64");
  const logoDataUrl = `data:image/png;base64,${logoBase64}`;

  /* QR: level M (15% recovery) — more robust on thermal ink imperfections */
  const qrPx = fmt === "58" ? 300 : 380;
  const qrDataUrl = await QRCode.toDataURL(ticket.qr_token, {
    width: qrPx,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#FFFFFF" },
  });

  const matchDateFmt = format(new Date(ticket.match.match_date), "EEE d MMM yyyy — HH'h'mm", { locale: fr });
  const soldAtFmt    = format(new Date(ticket.sold_at), "dd/MM/yyyy HH:mm", { locale: fr });

  const body = renderTicketBlock(ticket, qrDataUrl, matchDateFmt, soldAtFmt, fmt, logoDataUrl);

  const html = `<!DOCTYPE html>
<html lang="fr" style="margin:0;padding:0;">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${ticket.serial_number}</title>
<style>${getPrintStyles(fmt)}</style>
<style>
@media print {
  /* Single-ticket isolation: hide everything, show only .print-ticket.
     position:absolute at (0,0) lets the browser compute page height from
     the ticket content only — prevents trailing whitespace on thermal printers. */
  body * { visibility: hidden; }
  .print-ticket, .print-ticket * { visibility: visible; }
  .print-ticket {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
  }
}
</style>
</head>
<body style="margin:0;padding:0;">
${body}
<button class="no-print" onclick="window.print()" style="display:block;margin:5mm auto;padding:2mm 5mm;font-size:10pt;cursor:pointer;">Imprimer</button>
<script>
window.onload = function() {
  var ticket = document.querySelector('.print-ticket');
  var pageW = '${fmt === "58" ? "58mm" : "72mm"}';
  if (ticket) {
    var rect = ticket.getBoundingClientRect();
    // Convert px→mm (96dpi reference pixel)
    var hMm = Math.ceil(rect.height * 25.4 / 96) + 3;
    // Measure top offset: any space above the ticket (body padding, etc.)
    var topOffsetMm = Math.ceil(rect.top * 25.4 / 96);
    // Negative margin-top cancels the hardware top margin the XPRINTER driver adds.
    // We negate the measured top offset so content starts at the very top of the paper.
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

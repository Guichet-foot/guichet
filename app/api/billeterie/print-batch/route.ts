import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import QRCode from "qrcode";
import { readFileSync } from "fs";
import { join } from "path";
import { getPrintStyles } from "@/lib/ticket-print-template";
import type { PrintFormat } from "@/lib/ticket-print-template";
import { fmtZone } from "@/lib/format";
import { fetchAll } from "@/lib/supabase/paginate";

/* eslint-disable @typescript-eslint/no-explicit-any */

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
  logoDataUrl: string
): string {
  const is58 = fmt === "58";
  const priceFmt = new Intl.NumberFormat("fr-FR").format(price);
  const createdAtFmt = format(new Date(ticket.created_at), "dd/MM/yyyy HH:mm", { locale: fr });

  const matchLines = matches
    .map((m) => {
      const dateFmt = format(new Date(m.match_date), "dd/MM/yy · HH'h'mm", { locale: fr });
      const home = m.home_team_zone ? `${trunc(m.home_team, 12)} (${fmtZone(m.home_team_zone)})` : trunc(m.home_team, 14);
      const away = m.away_team_zone ? `${trunc(m.away_team, 12)} (${fmtZone(m.away_team_zone)})` : trunc(m.away_team, 14);
      return `${home} vs ${away}<br><span style="font-style:italic">${dateFmt}</span>`;
    })
    .join("<br>");

  const namePt = is58 ? "9" : "11";
  const matchPt = is58 ? "6" : "7";

  return `
<div class="print-ticket">
<div class="logo-wrap c">
  <img src="${logoDataUrl}" class="logo-img" alt="Guichet Foot" />
</div>
<div class="sep"></div>
<div class="c" style="font-size:${namePt}pt;font-weight:900;line-height:1.3;letter-spacing:0.5px;">${bilName}</div>
<div class="c tiny" style="font-style:italic;margin-top:0.5mm;">PASS MULTI-MATCHS</div>
<div class="sep"></div>
<div class="c" style="font-size:${matchPt}pt;font-weight:600;line-height:1.45;">${matchLines}</div>
<div class="sep"></div>
<div class="c cat-prix">${priceFmt}&nbsp;FCFA</div>
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
      .select("id, qr_token, serial_number, created_at, billeterie_id, sold_by, seller:profiles!billeterie_tickets_sold_by_fkey(full_name)")
      .eq("sale_batch_id", batchId)
      .order("serial_number")
      .range(from, to)
  );

  if (tickets.length === 0) return new NextResponse("Aucun billet trouvé", { status: 404 });

  // Get billeterie details (all tickets in batch share the same billeterie)
  const billeterieId = tickets[0].billeterie_id;
  const { data: bil } = await adminClient
    .from("billeterie")
    .select("name, price, match_ids")
    .eq("id", billeterieId)
    .single();

  if (!bil) return new NextResponse("Billetterie introuvable", { status: 404 });

  const matchIds: string[] = bil.match_ids || [];
  const { data: matches } = matchIds.length > 0
    ? await adminClient.from("matches").select("id, home_team, away_team, match_date, home_team_zone, away_team_zone").in("id", matchIds).order("match_date")
    : { data: [] as any[] };

  const logoBase64 = readFileSync(join(process.cwd(), "public", "logoticket.png")).toString("base64");
  const logoDataUrl = `data:image/png;base64,${logoBase64}`;
  const qrPx = fmt === "58" ? 300 : 380;

  const sellerName = (tickets[0] as any).seller?.full_name || "—";

  const ticketBlocks = await Promise.all(
    tickets.map(async (ticket: any) => {
      const qrContent = `BIL-${ticket.qr_token}`;
      const qrDataUrl = await QRCode.toDataURL(qrContent, {
        width: qrPx,
        margin: 2,
        errorCorrectionLevel: "M",
        color: { dark: "#000000", light: "#FFFFFF" },
      });
      return renderBilleterieTicket(ticket, bil.name, bil.price, matches || [], sellerName, qrDataUrl, fmt, logoDataUrl);
    })
  );

  const pageBreak = `<div style="break-after:page;page-break-after:always;height:0;"></div>`;
  const blocksHtml = ticketBlocks
    .map((b, i) => (i < ticketBlocks.length - 1 ? `<div class="ticket-wrap">${b}</div>${pageBreak}` : `<div class="ticket-wrap">${b}</div>`))
    .join("\n");

  const totalPriceFmt = new Intl.NumberFormat("fr-FR").format(tickets.length * bil.price);

  const html = `<!DOCTYPE html>
<html lang="fr" style="margin:0;padding:0;">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Billetterie — ${bil.name}</title>
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
    tickets.forEach(function(t) { var h = t.getBoundingClientRect().height; if (h > maxH) maxH = h; });
    var hMm = Math.ceil(maxH * 25.4 / 96) + 3;
    var firstTop = tickets[0].getBoundingClientRect().top;
    var topOffsetMm = Math.ceil(firstTop * 25.4 / 96);
    var topMarginMm = topOffsetMm > 0 ? -topOffsetMm : 0;
    var s = document.createElement('style');
    s.textContent = '@page { size: ' + pageW + ' ' + hMm + 'mm; margin-top: ' + topMarginMm + 'mm; margin-right: 0mm; margin-bottom: 0mm; margin-left: 0mm; }';
    document.head.appendChild(s);
  }
  setTimeout(function() { window.print(); }, 500);
  window.addEventListener('afterprint', function() { if (window.opener) window.close(); });
};
</script>
</body>
</html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

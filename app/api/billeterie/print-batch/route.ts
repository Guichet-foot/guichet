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

  const namePt = is58 ? "9" : "11";
  const matchPt = is58 ? "6" : "7";
  const passLine = matchDateFmt
    ? `PASS MULTI-MATCHS &middot; ${matchDateFmt}`
    : "PASS MULTI-MATCHS";

  return `
<div class="print-ticket">
<div class="logo-wrap c">
  <img src="${logoDataUrl}" class="logo-img" alt="Guichet Foot" />
</div>
<div class="sep"></div>
<div class="c" style="font-size:${namePt}pt;font-weight:900;line-height:1.3;letter-spacing:0.5px;">${bilName}</div>
<div class="c tiny" style="font-style:italic;margin-top:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${passLine}</div>
<div class="sep"></div>
<div class="c" style="font-size:${matchPt}pt;font-weight:600;line-height:1.3;">${matchLines}</div>
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

  // Les billets sont des blocs directs dans <body> — le CSS gère les sauts de page
  const blocksHtml = ticketBlocks.join("\n");

  const totalPriceFmt = new Intl.NumberFormat("fr-FR").format(tickets.length * bil.price);

  // Surcharges CSS compactes propres aux billets billeterie (n'affecte pas les billets réguliers)
  const is58bck = fmt === "58";
  const bilCompactCss = `
  /* Compact billeterie overrides */
  .sep { margin: 0.4mm 0; }
  .qr { margin: 0.3mm auto 0.2mm; }
  .bon-match { margin-top: 0 !important; }
  .logo-wrap { height: ${is58bck ? "10mm" : "13mm"} !important; }
  .logo-img  { height: ${is58bck ? "17mm" : "22mm"} !important; }
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

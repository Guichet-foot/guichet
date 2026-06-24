import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import QRCode from "qrcode";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: ticket } = await supabase
    .from("tickets")
    .select(
      "*, match:matches(home_team, away_team, venue, match_date), category:ticket_categories(name), seller:profiles!tickets_sold_by_fkey(full_name)"
    )
    .eq("id", id)
    .single();

  if (!ticket) {
    return new NextResponse("Billet introuvable", { status: 404 });
  }

  const qrDataUrl = await QRCode.toDataURL(ticket.qr_token, {
    width: 160,
    margin: 0,
    color: { dark: "#000000", light: "#FFFFFF" },
  });

  const matchDate = format(
    new Date(ticket.match.match_date),
    "EEE d MMM yyyy — HH'h'mm",
    { locale: fr }
  );

  const soldAt = format(new Date(ticket.sold_at), "dd/MM HH:mm", {
    locale: fr,
  });

  const priceFmt = new Intl.NumberFormat("fr-FR").format(ticket.price);

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${ticket.serial_number}</title>
<style>
  @page { size: 72mm auto; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 72mm;
    font-family: 'Courier New', monospace;
    font-size: 9pt;
    color: #000;
    background: #fff;
    padding: 2mm 3mm;
    line-height: 1.2;
  }
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
  @media print {
    html, body { width: 72mm; margin: 0; padding: 2mm 3mm; }
    .no-print { display: none !important; }
  }
  @media screen {
    body { max-width: 72mm; margin: 10px auto; border: 1px solid #ccc; }
  }
</style>
</head>
<body>
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

<button class="no-print" onclick="window.print()" style="display:block;margin:5mm auto;padding:2mm 5mm;font-size:10pt;cursor:pointer;">Imprimer</button>

<script>
window.onload = function() {
  setTimeout(function() { window.print(); }, 300);
};
</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

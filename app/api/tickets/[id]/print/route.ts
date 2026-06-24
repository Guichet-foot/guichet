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
    width: 200,
    margin: 1,
    color: { dark: "#000000", light: "#FFFFFF" },
  });

  const matchDate = format(
    new Date(ticket.match.match_date),
    "EEE d MMM yyyy — HH'h'mm",
    { locale: fr }
  );

  const soldAt = format(new Date(ticket.sold_at), "dd/MM/yyyy HH:mm", {
    locale: fr,
  });

  const priceFmt = new Intl.NumberFormat("fr-FR").format(ticket.price);

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Billet ${ticket.serial_number}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 80mm;
    font-family: 'Courier New', monospace;
    font-size: 11pt;
    color: #000;
    background: #fff;
    padding: 4mm;
  }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .separator {
    border-top: 1px dashed #000;
    margin: 3mm 0;
  }
  .logo {
    font-size: 16pt;
    font-weight: bold;
    letter-spacing: 2px;
    margin-bottom: 2mm;
  }
  .teams {
    font-size: 13pt;
    font-weight: bold;
    line-height: 1.4;
  }
  .vs {
    font-size: 10pt;
    font-weight: normal;
    color: #555;
  }
  .info {
    font-size: 9pt;
    line-height: 1.5;
  }
  .category {
    font-size: 18pt;
    font-weight: bold;
  }
  .price {
    font-size: 16pt;
    font-weight: bold;
  }
  .qr { margin: 3mm auto; }
  .qr img { width: 35mm; height: 35mm; }
  .serial { font-size: 9pt; }
  .footer {
    font-size: 7pt;
    color: #666;
    margin-top: 2mm;
  }
  @media print {
    html, body { width: 80mm; margin: 0; padding: 4mm; }
    .no-print { display: none !important; }
  }
  @media screen {
    body {
      max-width: 80mm;
      margin: 20px auto;
      border: 1px solid #ccc;
      padding: 4mm;
    }
  }
</style>
</head>
<body>
  <div class="center">
    <div class="logo">GUICHET FOOT</div>
  </div>

  <div class="separator"></div>

  <div class="center teams">
    ${ticket.match.home_team}<br>
    <span class="vs">vs</span><br>
    ${ticket.match.away_team}
  </div>

  <div class="center info" style="margin-top:2mm">
    ${ticket.match.venue}<br>
    ${matchDate}
  </div>

  <div class="separator"></div>

  <div class="center">
    <div class="category">${ticket.category.name}</div>
    <div class="price">${priceFmt} FCFA</div>
  </div>

  <div class="separator"></div>

  <div class="center qr">
    <img src="${qrDataUrl}" alt="QR Code" />
  </div>

  <div class="center serial">
    N° ${ticket.serial_number}<br>
    Caissier : ${ticket.seller.full_name}<br>
    ${soldAt}
  </div>

  <div class="separator"></div>

  <div class="center footer">
    Valable uniquement ce match<br>
    Non remboursable
  </div>

  <script>
    window.onload = function() {
      window.print();
      window.onafterprint = function() { window.close(); };
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

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { BulkCardsPDF, CardPDFData } from "@/lib/pdf/card-pdf";
import QRCode from "qrcode";
import { readFileSync } from "fs";
import { join } from "path";
import React from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

async function fetchBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");
    const ct = res.headers.get("content-type") || "image/jpeg";
    return `data:${ct};base64,${b64}`;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Non authentifié", { status: 401 });

  const body = await request.json();
  const { ids } = body as { ids: string[] };

  if (!ids || ids.length === 0) {
    return new NextResponse("Aucune carte sélectionnée", { status: 400 });
  }

  const adminClient = await createAdminClient();
  const { data: cards } = await adminClient
    .from("access_cards")
    .select("*")
    .in("id", ids);

  if (!cards || cards.length === 0) {
    return new NextResponse("Aucune carte trouvée", { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://guichet-pi.vercel.app";
  const logoBuf = readFileSync(join(process.cwd(), "public", "logoodcavdes.png"));
  const logoDataUrl = `data:image/png;base64,${logoBuf.toString("base64")}`;

  // Generate QR + photo for each card in parallel
  const cardData: CardPDFData[] = await Promise.all(
    cards.map(async (card: any) => {
      const [qrDataUrl, photoDataUrl] = await Promise.all([
        QRCode.toDataURL(`${appUrl}/carte/${card.qr_token}`, {
          width: 200, margin: 2, errorCorrectionLevel: "M",
          color: { dark: "#000000", light: "#ffffff" },
        }),
        card.photo_url ? fetchBase64(card.photo_url) : Promise.resolve(null),
      ]);
      return { ...card, qrDataUrl, logoDataUrl, photoDataUrl };
    })
  );

  const buffer = await renderToBuffer(
    React.createElement(BulkCardsPDF, { cards: cardData }) as any
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="cartes-acces.pdf"`,
    },
  });
}

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import QRCode from "qrcode";
import { readFileSync } from "fs";
import { join } from "path";
import React from "react";

async function fetchBase64(url: string): Promise<{ b64: string; ct: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return {
      b64: Buffer.from(buf).toString("base64"),
      ct: res.headers.get("content-type") || "image/jpeg",
    };
  } catch {
    return null;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new NextResponse("Non authentifié", { status: 401 });

    const { id } = await params;
    const adminClient = await createAdminClient();
    const { data: card } = await adminClient
      .from("access_cards")
      .select("*")
      .eq("id", id)
      .single();

    if (!card) return new NextResponse("Carte introuvable", { status: 404 });

    // Dynamic imports — avoids module-level crash on Vercel if library fails to load.
    const [{ renderToBuffer }, { SingleCardPDF }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("@/lib/pdf/card-pdf"),
    ]);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://guichet-pi.vercel.app";

    const [logoBuf, qrDataUrl, photo] = await Promise.all([
      Promise.resolve(readFileSync(join(process.cwd(), "public", "logoodcavdes.png"))),
      QRCode.toDataURL(`${appUrl}/carte/${card.qr_token}`, {
        width: 300, margin: 2, errorCorrectionLevel: "M",
        color: { dark: "#000000", light: "#ffffff" },
      }),
      card.photo_url ? fetchBase64(card.photo_url) : Promise.resolve(null),
    ]);

    const logoDataUrl = `data:image/png;base64,${logoBuf.toString("base64")}`;
    const photoDataUrl = photo ? `data:${photo.ct};base64,${photo.b64}` : null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(
      React.createElement(SingleCardPDF, {
        card: { ...card, qrDataUrl, logoDataUrl, photoDataUrl },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any
    );

    const slug = card.full_name.replace(/\s+/g, "-").toLowerCase();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="carte-${slug}.pdf"`,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error
      ? `${err.name}: ${err.message || "(no message)"}`
      : String(err) || "Erreur interne";
    console.error("[download-pdf] error:", err);
    return new NextResponse(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

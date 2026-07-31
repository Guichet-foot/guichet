import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { BulkCardsPDF, CardPDFData } from "@/lib/pdf/card-pdf";
import QRCode from "qrcode";
import { readFileSync } from "fs";
import { join } from "path";
import React from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

/* eslint-disable @typescript-eslint/no-explicit-any */

const BUCKET = "card-photos";

// Extract the storage file path from a Supabase public URL
function extractStoragePath(url: string): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;
  const prefix = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/`;
  if (url.startsWith(prefix)) {
    return decodeURIComponent(url.slice(prefix.length).split("?")[0]);
  }
  return null;
}

async function fetchBase64WithRetry(url: string, retries = 2): Promise<string | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12_000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      const b64 = Buffer.from(buf).toString("base64");
      const ct = res.headers.get("content-type") || "image/jpeg";
      return `data:${ct};base64,${b64}`;
    } catch {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }
  return null;
}

// Download a photo: tries admin SDK first (fast, no CORS), falls back to HTTP fetch
async function downloadPhoto(
  adminClient: SupabaseClient,
  photoUrl: string
): Promise<string | null> {
  const filePath = extractStoragePath(photoUrl);
  if (filePath) {
    const { data, error } = await adminClient.storage.from(BUCKET).download(filePath);
    if (!error && data) {
      const buf = await data.arrayBuffer();
      const b64 = Buffer.from(buf).toString("base64");
      const ct = data.type || "image/jpeg";
      return `data:${ct};base64,${b64}`;
    }
  }
  // Fallback: HTTP fetch with timeout + retry (covers URLs not matching expected prefix)
  return fetchBase64WithRetry(photoUrl);
}

async function processInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
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

  // Step 1: generate all QR codes in parallel (CPU-only, no network)
  const qrMap = new Map<string, string>();
  await Promise.all(
    cards.map(async (card: any) => {
      const qrDataUrl = await QRCode.toDataURL(`${appUrl}/carte/${card.qr_token}`, {
        width: 200, margin: 2, errorCorrectionLevel: "M",
        color: { dark: "#000000", light: "#ffffff" },
      });
      qrMap.set(card.id, qrDataUrl);
    })
  );

  // Step 2: download photos in batches of 12 via admin SDK (reliable, no HTTP rate limit)
  const cardData: CardPDFData[] = await processInBatches(
    cards,
    12,
    async (card: any) => {
      const photoDataUrl = card.photo_url
        ? await downloadPhoto(adminClient, card.photo_url)
        : null;
      return {
        ...card,
        qrDataUrl: qrMap.get(card.id) ?? "",
        logoDataUrl,
        photoDataUrl,
      };
    }
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

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

function extractStoragePath(url: string): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;
  const prefix = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/`;
  if (url.startsWith(prefix)) {
    return decodeURIComponent(url.slice(prefix.length).split("?")[0]);
  }
  return null;
}

async function fetchBase64(url: string, retries = 2): Promise<string | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      const b64 = Buffer.from(buf).toString("base64");
      // Normalise content-type: PDF renderer only handles image/*
      const rawCt = res.headers.get("content-type") || "";
      const ct = rawCt.startsWith("image/") ? rawCt : "image/jpeg";
      return `data:${ct};base64,${b64}`;
    } catch {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
  }
  return null;
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

// Pre-sign all photo URLs in one API call, then fetch via HTTP
async function buildSignedPhotoMap(
  adminClient: SupabaseClient,
  cards: any[]
): Promise<Map<string, string>> {
  // Extract storage paths for cards that have photos
  const pathEntries: { cardId: string; filePath: string }[] = [];
  for (const card of cards) {
    if (card.photo_url) {
      const filePath = extractStoragePath(card.photo_url);
      if (filePath) pathEntries.push({ cardId: card.id, filePath });
    }
  }

  if (pathEntries.length === 0) return new Map();

  // One API call to sign all paths (valid 10 minutes)
  const { data: signed } = await adminClient.storage
    .from(BUCKET)
    .createSignedUrls(pathEntries.map((e) => e.filePath), 600);

  // Map cardId -> signedUrl
  const signedMap = new Map<string, string>();
  if (signed) {
    for (let i = 0; i < pathEntries.length; i++) {
      const entry = signed[i];
      if (entry?.signedUrl) {
        signedMap.set(pathEntries[i].cardId, entry.signedUrl);
      }
    }
  }
  return signedMap;
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

  // Step 2: pre-sign all photo URLs in one API call
  const signedPhotoMap = await buildSignedPhotoMap(adminClient, cards);

  // Step 3: fetch photos in batches using signed URLs
  const cardData: CardPDFData[] = await processInBatches(
    cards,
    10,
    async (card: any) => {
      let photoDataUrl: string | null = null;
      if (card.photo_url) {
        const signedUrl = signedPhotoMap.get(card.id);
        // Try signed URL first, fall back to public URL
        photoDataUrl = signedUrl
          ? await fetchBase64(signedUrl)
          : await fetchBase64(card.photo_url);
      }
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

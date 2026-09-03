import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import QRCode from "qrcode";
import { readFileSync } from "fs";
import { join } from "path";
import React from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CardPDFData } from "@/lib/pdf/card-pdf";

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

// Fetch bytes with retry — transient network errors under concurrent load must not
// silently drop a photo (previously caused random blank photos in bulk PDFs).
async function fetchBytesWithRetry(
  url: string,
  retries = 2
): Promise<{ buf: ArrayBuffer; ct?: string } | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const r = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (r.ok) {
        return { buf: await r.arrayBuffer(), ct: r.headers.get("content-type") || undefined };
      }
    } catch { /* retry below */ }
    if (attempt < retries) {
      await new Promise((res) => setTimeout(res, 400 * (attempt + 1)));
    }
  }
  return null;
}

// Convert image bytes to JPEG data URL via sharp (with plain base64 fallback).
async function toJpegDataUrl(
  buf: ArrayBuffer,
  contentType?: string,
  sharpMod: any = null
): Promise<string | null> {
  if (sharpMod) {
    try {
      const jpegBuf = await sharpMod(Buffer.from(buf)).rotate().jpeg({ quality: 88 }).toBuffer();
      return `data:image/jpeg;base64,${jpegBuf.toString("base64")}`;
    } catch { /* fall through to raw fallback */ }
  }
  try {
    const b64 = Buffer.from(buf).toString("base64");
    return `data:${contentType || "image/jpeg"};base64,${b64}`;
  } catch {
    return null;
  }
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

async function buildSignedPhotoMap(
  adminClient: SupabaseClient,
  cards: any[]
): Promise<Map<string, string>> {
  const pathEntries: { cardId: string; filePath: string }[] = [];
  for (const card of cards) {
    if (card.photo_url) {
      const filePath = extractStoragePath(card.photo_url);
      if (filePath) pathEntries.push({ cardId: card.id, filePath });
    }
  }
  if (pathEntries.length === 0) return new Map();

  const { data: signed } = await adminClient.storage
    .from(BUCKET)
    .createSignedUrls(pathEntries.map((e) => e.filePath), 600);

  const signedMap = new Map<string, string>();
  if (signed) {
    for (let i = 0; i < pathEntries.length; i++) {
      const entry = signed[i];
      if (entry?.signedUrl) signedMap.set(pathEntries[i].cardId, entry.signedUrl);
    }
  }
  return signedMap;
}

export async function POST(request: Request) {
  try {
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

    // Dynamic imports inside try/catch so module-load errors are caught and returned as JSON.
    const [{ renderToBuffer }, { BulkCardsPDF }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("@/lib/pdf/card-pdf"),
    ]);

    // sharp is optional — fall back to raw base64 if unavailable in this environment.
    const sharpMod = await import("sharp").then((m) => m.default).catch(() => null);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://guichet-pi.vercel.app";
    const logoBuf = readFileSync(join(process.cwd(), "public", "logoodcavdes.png"));
    const logoDataUrl = `data:image/png;base64,${logoBuf.toString("base64")}`;

    // Step 1: QR codes (CPU-only, fully parallel)
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

    // Step 2: pre-sign photo URLs (one batch API call)
    const signedPhotoMap = await buildSignedPhotoMap(adminClient, cards);

    // Step 3: fetch + convert photos in batches of 10
    const cardData: CardPDFData[] = await processInBatches(
      cards,
      10,
      async (card: any) => {
        let photoDataUrl: string | null = null;
        if (card.photo_url) {
          const url = signedPhotoMap.get(card.id) ?? card.photo_url;
          const fetched = await fetchBytesWithRetry(url);
          if (fetched) {
            photoDataUrl = await toJpegDataUrl(fetched.buf, fetched.ct, sharpMod);
          }
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
  } catch (err: unknown) {
    const msg = err instanceof Error
      ? `${err.name}: ${err.message || "(no message)"}`
      : String(err) || "Erreur interne";
    console.error("[bulk-pdf] error:", err);
    return new NextResponse(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

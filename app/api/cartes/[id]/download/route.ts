import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import QRCode from "qrcode";
import { readFileSync } from "fs";
import { join } from "path";
import React from "react";

async function fetchBytes(url: string, retries = 2): Promise<{ buf: ArrayBuffer; ct?: string } | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        return { buf: await res.arrayBuffer(), ct: res.headers.get("content-type") || undefined };
      }
    } catch { /* retry below */ }
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  return null;
}

// Sanitize a JPEG buffer for react-pdf's built-in decoder ("jay-peg"), which throws
// "Unknown version" (and silently renders a blank image) on two confirmed real-world cases:
//  1. APPn/COM metadata segments it can't parse (e.g. an embedded ICC color profile).
//  2. 16-bit precision DQT (quantization) tables — jay-peg hardcodes 64-byte (8-bit) table
//     entries, so a 128-byte 16-bit table desyncs its marker parser for the rest of the file.
// Fix: drop APPn/COM segments, and downgrade any 16-bit DQT table to 8-bit (clamped — pixel
// data is untouched, only quantization coefficients are truncated to a byte, imperceptible
// for a small ID photo). Verified against real failing photos: fixes both cases.
function sanitizeJpegForReactPdf(buf: Buffer): Buffer {
  if (buf.length < 4 || buf.readUInt16BE(0) !== 0xffd8) return buf;
  const out: number[] = [0xff, 0xd8];
  let i = 2;
  while (i < buf.length - 1) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      i += 2;
      continue;
    }
    if (i + 3 >= buf.length) break;
    const len = buf.readUInt16BE(i + 2);
    if (marker === 0xda) {
      let end = buf.length;
      if (buf[end - 2] === 0xff && buf[end - 1] === 0xd9) end -= 2;
      for (let k = i; k < end; k++) out.push(buf[k]);
      out.push(0xff, 0xd9);
      return Buffer.from(out);
    }
    const isMetadata = (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe;
    if (isMetadata) {
      i += 2 + len;
      continue;
    }
    if (marker === 0xdb) {
      const segEnd = i + 2 + len;
      const newTables: number[] = [];
      let p = i + 4;
      let changed = false;
      while (p < segEnd) {
        const idByte = buf[p];
        const precision = idByte >> 4;
        const tableId = idByte & 0x0f;
        if (precision === 0) {
          newTables.push(idByte);
          for (let k = 0; k < 64; k++) newTables.push(buf[p + 1 + k]);
          p += 65;
        } else {
          changed = true;
          newTables.push(tableId);
          for (let k = 0; k < 64; k++) newTables.push(Math.min(255, buf.readUInt16BE(p + 1 + k * 2)));
          p += 129;
        }
      }
      if (changed) {
        const newLen = 2 + newTables.length;
        out.push(0xff, 0xdb, (newLen >> 8) & 0xff, newLen & 0xff, ...newTables);
      } else {
        for (let k = i; k < segEnd; k++) out.push(buf[k]);
      }
      i = segEnd;
      continue;
    }
    for (let k = i; k < i + 2 + len; k++) out.push(buf[k]);
    i += 2 + len;
  }
  out.push(0xff, 0xd9);
  return Buffer.from(out);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function toPhotoDataUrl(buf: ArrayBuffer, contentType: string | undefined, sharpMod: any): Promise<string | null> {
  const original = Buffer.from(buf);
  const isJpeg = original.length >= 2 && original.readUInt16BE(0) === 0xffd8;

  if (sharpMod) {
    try {
      // Feed sharp the ORIGINAL bytes (EXIF intact) so .rotate() can read the orientation
      // tag and physically bake the rotation in — sanitizing first would strip that tag.
      const jpegBuf = await sharpMod(original).rotate().jpeg({ quality: 88 }).toBuffer();
      return `data:image/jpeg;base64,${jpegBuf.toString("base64")}`;
    } catch { /* fall through to sanitized raw fallback */ }
  }
  const cleaned = isJpeg ? sanitizeJpegForReactPdf(original) : original;
  try {
    return `data:${isJpeg ? "image/jpeg" : (contentType || "image/jpeg")};base64,${cleaned.toString("base64")}`;
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
    const sharpMod = await import("sharp").then((m) => m.default).catch(() => null);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://guichet-pi.vercel.app";

    const [logoBuf, qrDataUrl, fetchedPhoto] = await Promise.all([
      Promise.resolve(readFileSync(join(process.cwd(), "public", "logoodcavdes.png"))),
      QRCode.toDataURL(`${appUrl}/carte/${card.qr_token}`, {
        width: 300, margin: 2, errorCorrectionLevel: "M",
        color: { dark: "#000000", light: "#ffffff" },
      }),
      card.photo_url ? fetchBytes(card.photo_url) : Promise.resolve(null),
    ]);

    const logoDataUrl = `data:image/png;base64,${logoBuf.toString("base64")}`;
    const photoDataUrl = fetchedPhoto
      ? await toPhotoDataUrl(fetchedPhoto.buf, fetchedPhoto.ct, sharpMod)
      : null;

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

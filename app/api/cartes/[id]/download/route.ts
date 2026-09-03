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

// Strip APPn (EXIF/ICC/JFIF-extension) and COM segments from a JPEG buffer.
// react-pdf's built-in JPEG marker parser ("jay-peg") throws "Unknown version" on certain
// uncommon metadata segments (e.g. embedded ICC color profiles) — react-pdf then silently
// renders a blank image instead of surfacing the error. Metadata isn't needed to render
// the photo, so stripping it is safe and doesn't touch pixel data.
function stripJpegMetadata(buf: Buffer): Buffer {
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
    if (!isMetadata) {
      for (let k = i; k < i + 2 + len; k++) out.push(buf[k]);
    }
    i += 2 + len;
  }
  out.push(0xff, 0xd9);
  return Buffer.from(out);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function toPhotoDataUrl(buf: ArrayBuffer, contentType: string | undefined, sharpMod: any): Promise<string | null> {
  const original = Buffer.from(buf);
  const isJpeg = original.length >= 2 && original.readUInt16BE(0) === 0xffd8;
  const cleaned = isJpeg ? stripJpegMetadata(original) : original;

  if (sharpMod) {
    try {
      const jpegBuf = await sharpMod(cleaned).rotate().jpeg({ quality: 88 }).toBuffer();
      return `data:image/jpeg;base64,${jpegBuf.toString("base64")}`;
    } catch { /* fall through to raw fallback */ }
  }
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

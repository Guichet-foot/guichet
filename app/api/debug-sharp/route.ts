import { NextResponse } from "next/server";

// Temporary diagnostic route — confirms whether sharp actually loads and runs in this
// Vercel deployment. Remove once the cartes-pdf rotation issue is resolved.
export async function GET() {
  const result: Record<string, unknown> = {};

  try {
    const mod = await import("sharp");
    const sharpFn = mod.default;
    result.importOk = true;
    result.hasDefault = typeof sharpFn === "function";

    // 1x1 red PNG, base64
    const tinyPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    const meta = await sharpFn(tinyPng).metadata();
    result.metadataOk = true;
    result.metadata = meta;

    const out = await sharpFn(tinyPng).jpeg({ quality: 80 }).toBuffer();
    result.convertOk = true;
    result.outputBytes = out.length;
  } catch (err: unknown) {
    result.error = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack}` : String(err);
  }

  return NextResponse.json(result);
}

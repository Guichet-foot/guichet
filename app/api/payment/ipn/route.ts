import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request: Request) {
  let body: Record<string, string>;

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    body = await request.json();
  } else {
    const text = await request.text();
    const params = new URLSearchParams(text);
    body = Object.fromEntries(params.entries());
  }

  // Vérifier la signature Paytech
  const apiKey = process.env.PAYTECH_API_KEY || "";
  const apiSecret = process.env.PAYTECH_API_SECRET || "";
  const expectedKeyHash = crypto.createHash("sha256").update(apiKey).digest("hex");
  const expectedSecretHash = crypto.createHash("sha256").update(apiSecret).digest("hex");

  if (
    body.api_key_sha256 !== expectedKeyHash ||
    body.api_secret_sha256 !== expectedSecretHash
  ) {
    return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
  }

  if (body.type_event !== "sale_complete") {
    return NextResponse.json({ ok: true });
  }

  const refCommand = body.ref_command;
  if (!refCommand) {
    return NextResponse.json({ error: "ref_command manquant" }, { status: 400 });
  }

  const adminClient = await createAdminClient();
  const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error } = await adminClient
    .from("zone_daily_payments")
    .update({
      status: "success",
      payment_method: body.payment_method || null,
      paid_at: new Date().toISOString(),
      valid_until: validUntil,
    })
    .eq("ref_command", refCommand)
    .eq("status", "pending");

  if (error) {
    console.error("IPN update error:", error);
    return NextResponse.json({ error: "DB update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

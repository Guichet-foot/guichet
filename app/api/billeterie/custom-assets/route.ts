import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const ALLOWED_ROLES = ["super_admin", "president_odcav", "tresorier", "fondateur", "admin_zone"];

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const kind = formData.get("kind") as string | null;

  // "background" (full-page photo for the old 145mm poster-style ticket) was
  // dropped: that layout was wider than a thermal roll and thermal heads
  // render photos as unreadable noise — the only custom asset still printed
  // is the small organizer logo, which fits the thermal ticket fine.
  if (!file || kind !== "logo") {
    return NextResponse.json({ error: "Fichier et logo requis" }, { status: 400 });
  }

  if (file.size > 5_242_880) {
    return NextResponse.json({ error: "L'image ne doit pas dépasser 5 Mo" }, { status: 400 });
  }
  if (file.type !== "image/jpeg" && file.type !== "image/png") {
    return NextResponse.json({ error: "Format d'image invalide (JPEG ou PNG uniquement)" }, { status: 400 });
  }

  let buffer = Buffer.from(await file.arrayBuffer());
  let contentType = file.type;
  let ext = file.type === "image/png" ? "png" : "jpg";

  // Downscale + re-encode as JPEG — the ticket only ever displays this at a
  // few hundred CSS px, so an untouched phone photo (often several MB) just
  // bloats every printed ticket for no visible gain. Flattened to white
  // since it's always shown on the ticket's white header area.
  try {
    const sharp = (await import("sharp")).default;
    buffer = await sharp(buffer)
      .rotate()
      .resize({ width: 600, withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
    contentType = "image/jpeg";
    ext = "jpg";
  } catch {
    // sharp unavailable in this environment — store the original upload as-is.
  }

  const path = `custom-tickets/${user.id}-logo-${Date.now()}.${ext}`;

  const adminClient = await createAdminClient();
  const { error: uploadError } = await adminClient.storage
    .from("billeterie-assets")
    .upload(path, buffer, { upsert: true, contentType });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: { publicUrl } } = adminClient.storage.from("billeterie-assets").getPublicUrl(path);
  return NextResponse.json({ url: publicUrl });
}

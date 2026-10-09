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

  if (!file || (kind !== "logo" && kind !== "background")) {
    return NextResponse.json({ error: "Fichier et type (logo/background) requis" }, { status: 400 });
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

  // Downscale + re-encode as JPEG — the ticket only ever displays these at a
  // few hundred CSS px, so an untouched phone photo (often several MB) just
  // bloats every printed ticket for no visible gain. Logos are flattened to
  // white since they're always shown on the ticket's white header area.
  // Backgrounds get the grayscale/brightness/contrast look baked into the
  // pixels once here instead of a CSS filter the browser would otherwise
  // have to recompute on every single printed page of a batch.
  try {
    const sharp = (await import("sharp")).default;
    let pipeline = sharp(buffer).rotate();
    if (kind === "logo") {
      pipeline = pipeline
        .resize({ width: 600, withoutEnlargement: true })
        .flatten({ background: "#ffffff" });
    } else {
      pipeline = pipeline
        .resize({ width: 1200, withoutEnlargement: true })
        .flatten({ background: "#ffffff" })
        .grayscale()
        .modulate({ brightness: 1.75 })
        .linear(0.85, 128 * (1 - 0.85));
    }
    buffer = await pipeline.jpeg({ quality: kind === "logo" ? 85 : 78, mozjpeg: true }).toBuffer();
    contentType = "image/jpeg";
    ext = "jpg";
  } catch {
    // sharp unavailable in this environment — store the original upload as-is.
  }

  const path = `custom-tickets/${user.id}-${kind}-${Date.now()}.${ext}`;

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

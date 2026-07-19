import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, zone_id")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin_zone", "super_admin", "fondateur"].includes(profile.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const zoneId = formData.get("zoneId") as string | null;

  if (!file || !zoneId) {
    return NextResponse.json({ error: "Fichier et zoneId requis" }, { status: 400 });
  }

  // Vérifier que l'admin_zone n'upload que pour sa propre zone
  if (profile.role === "admin_zone" && profile.zone_id !== zoneId) {
    return NextResponse.json({ error: "Accès refusé à cette zone" }, { status: 403 });
  }

  if (file.size > 1_048_576) {
    return NextResponse.json({ error: "Le logo ne doit pas dépasser 1 Mo" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Format d'image invalide" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() || "png";
  const path = `zone-logos/zone-${zoneId}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const adminClient = await createAdminClient();
  const { error: uploadError } = await adminClient.storage
    .from("odcav-assets")
    .upload(path, buffer, { upsert: true, contentType: file.type });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: { publicUrl } } = adminClient.storage.from("odcav-assets").getPublicUrl(path);
  return NextResponse.json({ url: publicUrl });
}

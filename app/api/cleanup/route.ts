import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Route appelée par le cron Vercel (vercel.json) une fois par jour
// Supprime tous les billets de plus de 24h
export async function GET() {
  try {
    const supabase = await createAdminClient();
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { error, count } = await supabase
      .from("tickets")
      .delete({ count: "exact" })
      .lt("sold_at", cutoff);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deleted: count, cutoff });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

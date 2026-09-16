import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/paginate";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Temporary diagnostic route — reproduces the exact finances/page.tsx billeterie scan
// query for Zone 5B in the actual production runtime, to find why it returns 0 scans
// on a date the raw DB clearly has 1414+ rows for. Remove once resolved.
export async function GET() {
  const result: Record<string, unknown> = {};
  const ZONE_ID = "e136f2d4-a708-4de6-9f16-dedbd71ee159";

  try {
    result.serverNow = new Date().toISOString();
    result.serverToday = new Date().toISOString().split("T")[0];

    const adminSupabase = await createAdminClient();
    result.hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    result.hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    result.serviceKeyPrefix = process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 20);

    const { data: allZoneMatchData, error: matchErr } = await adminSupabase
      .from("matches").select("id").eq("zone_id", ZONE_ID);
    result.matchErr = matchErr;
    const allScopeMatchIds = ((allZoneMatchData || []) as any[]).map((m) => m.id as string);
    result.allScopeMatchIds = allScopeMatchIds;

    const dateStart = new Date("2026-09-14T00:00:00");
    const dateEnd = new Date("2026-09-14T23:59:59.999");
    result.dateStartIso = dateStart.toISOString();
    result.dateEndIso = dateEnd.toISOString();

    // Replicate the EXACT gate chain from finances/page.tsx
    const scanMatchIds = allScopeMatchIds;
    result.scanMatchIdsLength = scanMatchIds.length;

    if (scanMatchIds.length > 0) {
      const scanMatchIdSet = new Set(scanMatchIds);
      const { data: allBilsRaw, error: bilsErr } = await adminSupabase
        .from("billeterie").select("id, price, match_ids, categories");
      result.bilsErr = bilsErr;
      result.allBilsRawCount = allBilsRaw?.length ?? null;
      const zoneBils = (allBilsRaw || []).filter((b: any) =>
        (b.match_ids || []).some((id: string) => scanMatchIdSet.has(id))
      );
      result.zoneBilsCount = zoneBils.length;
      result.zoneBilIds = zoneBils.map((b: any) => b.id);
      const zoneBilIds = zoneBils.map((b: any) => b.id as string);

      if (zoneBilIds.length > 0) {
        let lastErr: unknown = null;
        const periodBilScans = await fetchAll<any>((from, to) => {
          const q = adminSupabase.from("billeterie_scans")
            .select("ticket_id")
            .in("match_id", [...scanMatchIds]);
          return q.gte("scanned_at", dateStart.toISOString())
            .lte("scanned_at", dateEnd.toISOString())
            .range(from, to)
            .then((r) => { if (r.error) lastErr = r.error; return r; });
        });
        result.periodBilScansCount = periodBilScans.length;
        result.lastErr = lastErr;
      } else {
        result.skippedReason = "zoneBilIds.length === 0";
      }
    } else {
      result.skippedReason = "scanMatchIds.length === 0";
    }

    // All-time count too, for comparison
    const { count: allTimeCount, error: countErr } = await adminSupabase
      .from("billeterie_scans")
      .select("*", { count: "exact", head: true })
      .in("match_id", allScopeMatchIds);
    result.allTimeCount = allTimeCount;
    result.countErr = countErr;
  } catch (err: unknown) {
    result.caughtError = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack}` : String(err);
  }

  return NextResponse.json(result);
}

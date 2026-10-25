import { fetchAll } from "@/lib/supabase/paginate";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ScanStats {
  totalScanned: number;
  grossRevenue: number;
}

// Shared by the Zone / C3 (Communal) / ODCAV dashboard tabs — only the match
// scope (matchIds) differs between them, everything else is identical.
//
// matchIds must NOT be restricted by match_date: a match from yesterday can
// still have leftover blocs scanned today, so the match scope stays
// unrestricted and only the scan counts are filtered by scanned_at.
//
// Printed/unsold counts were dropped: billeterie_tickets accumulates every
// bloc ever printed for a billeterie regardless of when, so "Billets
// imprimés"/"Billets invendus" showed lifetime totals rather than anything
// tied to the selected period — reported as stale/incorrect and removed.
// Only scanned-today (a real event count) and its revenue remain.
export async function computeScanStats(
  adminClient: any,
  matchIds: string[],
  dateStart: Date,
  dateEnd: Date
): Promise<ScanStats> {
  if (matchIds.length === 0) {
    return { totalScanned: 0, grossRevenue: 0 };
  }

  const dateStartIso = dateStart.toISOString();
  const dateEndIso = dateEnd.toISOString();

  // Regular tickets — kept for forward-compat even though the platform
  // currently sells exclusively through billeterie (0 rows today).
  const [periodScannedTickets, { data: allBilsData }] = await Promise.all([
    fetchAll<any>((from, to) =>
      adminClient
        .from("tickets")
        .select("price, counts_as_revenue")
        .in("match_id", matchIds)
        .eq("status", "scanne")
        .gte("scanned_at", dateStartIso)
        .lte("scanned_at", dateEndIso)
        .order("id", { ascending: true })
        .range(from, to)
    ),
    adminClient.from("billeterie").select("id, price, match_ids, categories"),
  ]);

  // Billeterie — the platform's actual sales channel today.
  const matchIdSet = new Set(matchIds);
  const bils = ((allBilsData || []) as any[]).filter((b) =>
    ((b.match_ids || []) as string[]).some((id) => matchIdSet.has(id))
  );
  const bilIds = bils.map((b) => b.id as string);

  let bilScanned = 0;
  let bilRevenue = 0;

  if (bilIds.length > 0) {
    const bilPriceMap: Record<string, number> = {};
    const bilCatMap: Record<string, Array<{ name: string; price: number }>> = {};
    bils.forEach((b: any) => {
      bilPriceMap[b.id] = b.price || 0;
      if (b.categories) bilCatMap[b.id] = b.categories;
    });

    const periodBilScans = await fetchAll<any>((from, to) =>
      adminClient
        .from("billeterie_scans")
        .select("ticket_id")
        .in("match_id", matchIds)
        .gte("scanned_at", dateStartIso)
        .lte("scanned_at", dateEndIso)
        .order("id", { ascending: true })
        .range(from, to)
    );
    bilScanned = periodBilScans.length;

    const scannedTicketIds = [...new Set(periodBilScans.map((s: any) => s.ticket_id as string))];
    if (scannedTicketIds.length > 0) {
      const CHUNK = 150;
      const idChunks: string[][] = [];
      for (let i = 0; i < scannedTicketIds.length; i += CHUNK) idChunks.push(scannedTicketIds.slice(i, i + CHUNK));
      const chunks = await Promise.all(
        idChunks.map((ids) =>
          adminClient.from("billeterie_tickets").select("id, billeterie_id, category_name").in("id", ids)
        )
      );
      const ticketToBilId: Record<string, string> = {};
      const ticketToCat: Record<string, string | null> = {};
      chunks.forEach(({ data }: any) => {
        (data || []).forEach((t: any) => {
          ticketToBilId[t.id] = t.billeterie_id;
          ticketToCat[t.id] = t.category_name ?? null;
        });
      });
      bilRevenue = periodBilScans.reduce((sum: number, s: any) => {
        const bId = ticketToBilId[s.ticket_id as string];
        if (!bId) return sum;
        const catName = ticketToCat[s.ticket_id as string];
        const cats = bilCatMap[bId];
        if (cats && catName) {
          const cat = cats.find((c) => c.name === catName);
          return sum + (cat ? cat.price : 0);
        }
        return sum + (bilPriceMap[bId] || 0);
      }, 0);
    }
  }

  const totalScanned = periodScannedTickets.length + bilScanned;
  const grossRevenue =
    periodScannedTickets.filter((t: any) => t.counts_as_revenue).reduce((s: number, t: any) => s + (t.price || 0), 0) +
    bilRevenue;

  return { totalScanned, grossRevenue };
}

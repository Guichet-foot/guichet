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

export interface ZoneBreakdownRow {
  zoneId: string;
  zoneName: string;
  scanned: number;
  recettesBrutes: number;
  fraisODCAV: number;
  fraisBilletterie: number;
  recetteNette: number;
}

// Per-zone table for the Zone tab — same underlying scan/revenue data as
// computeScanStats, but bucketed by zone in a single pass instead of called
// once per zone (which would mean N queries for N zones, repeating the same
// full-table billeterie fetch each time).
export async function computeZoneBreakdown(
  adminClient: any,
  zones: { id: string; name: string }[],
  matchToZone: Map<string, string>,
  matchIds: string[],
  dateStart: Date,
  dateEnd: Date,
  odcavRate: number,
  feePerBlock: number
): Promise<ZoneBreakdownRow[]> {
  if (matchIds.length === 0) return [];

  const dateStartIso = dateStart.toISOString();
  const dateEndIso = dateEnd.toISOString();

  const scannedByZone = new Map<string, number>();
  const revenueByZone = new Map<string, number>();

  // Regular tickets — kept for forward-compat (currently 0 rows platform-wide).
  const periodTickets = await fetchAll<any>((from, to) =>
    adminClient
      .from("tickets")
      .select("match_id, price, counts_as_revenue")
      .in("match_id", matchIds)
      .eq("status", "scanne")
      .gte("scanned_at", dateStartIso)
      .lte("scanned_at", dateEndIso)
      .order("id", { ascending: true })
      .range(from, to)
  );
  for (const t of periodTickets) {
    const zId = matchToZone.get(t.match_id as string);
    if (!zId) continue;
    scannedByZone.set(zId, (scannedByZone.get(zId) || 0) + 1);
    if (t.counts_as_revenue) revenueByZone.set(zId, (revenueByZone.get(zId) || 0) + (t.price || 0));
  }

  // Billeterie — fetched once, reused both for scan revenue and for the
  // "blocks ordered" lookup below (avoids a second full-table fetch).
  const { data: allBilsData } = await adminClient
    .from("billeterie")
    .select("id, price, categories, match_ids, zone_id, blocks_ordered, block_order_date");
  const bilInfo = new Map<string, { price: number; cats: Array<{ name: string; price: number }> | null }>();
  ((allBilsData || []) as any[]).forEach((b) =>
    bilInfo.set(b.id as string, { price: b.price || 0, cats: (b.categories as any) || null })
  );

  const matchChunks: string[][] = [];
  for (let i = 0; i < matchIds.length; i += 100) matchChunks.push(matchIds.slice(i, i + 100));

  const scanChunks = await Promise.all(
    matchChunks.map((ids) =>
      fetchAll<any>((from, to) =>
        adminClient
          .from("billeterie_scans")
          .select("match_id, scanned_at, ticket:billeterie_tickets(billeterie_id, category_name)")
          .in("match_id", ids)
          .gte("scanned_at", dateStartIso)
          .lte("scanned_at", dateEndIso)
          .order("id", { ascending: true })
          .range(from, to)
      )
    )
  );

  for (const s of scanChunks.flat()) {
    const zId = matchToZone.get(s.match_id as string);
    if (!zId) continue;
    scannedByZone.set(zId, (scannedByZone.get(zId) || 0) + 1);

    const tk = Array.isArray(s.ticket) ? s.ticket[0] : s.ticket;
    const info = tk ? bilInfo.get(tk.billeterie_id as string) : undefined;
    let price = 0;
    if (info) {
      if (info.cats && tk.category_name) {
        const cat = info.cats.find((c) => c.name === tk.category_name);
        price = cat ? cat.price : 0;
      } else {
        price = info.price;
      }
    }
    revenueByZone.set(zId, (revenueByZone.get(zId) || 0) + price);
  }

  // Frais billetterie per zone: blocks ordered within the period, same
  // zone-attribution precedence as computeBlocksOrderedFee (direct zone_id
  // tag first, else inferred from the first overlapping match's zone).
  const matchIdSet = new Set(matchIds);
  const blocksByZone = new Map<string, number>();
  for (const b of (allBilsData || []) as any[]) {
    const n = (b.blocks_ordered as number) || 0;
    if (n <= 0 || !b.block_order_date) continue;
    const d = new Date(`${b.block_order_date}T12:00:00`);
    if (d < dateStart || d > dateEnd) continue;

    let zId: string | null = b.zone_id || null;
    if (!zId) {
      const bm: string[] = b.match_ids || [];
      const matchedId = bm.find((id) => matchIdSet.has(id));
      zId = matchedId ? matchToZone.get(matchedId) || null : null;
    }
    if (!zId) continue;
    blocksByZone.set(zId, (blocksByZone.get(zId) || 0) + n);
  }

  const rows: ZoneBreakdownRow[] = [];
  for (const zone of zones) {
    const scanned = scannedByZone.get(zone.id) || 0;
    const recettesBrutes = revenueByZone.get(zone.id) || 0;
    const blocksOrdered = blocksByZone.get(zone.id) || 0;
    if (scanned === 0 && recettesBrutes === 0 && blocksOrdered === 0) continue;
    const fraisODCAV = Math.round(recettesBrutes * odcavRate);
    const fraisBilletterie = blocksOrdered * feePerBlock;
    rows.push({
      zoneId: zone.id,
      zoneName: zone.name,
      scanned,
      recettesBrutes,
      fraisODCAV,
      fraisBilletterie,
      recetteNette: recettesBrutes - fraisODCAV - fraisBilletterie,
    });
  }

  rows.sort((a, b) => b.recettesBrutes - a.recettesBrutes || a.zoneName.localeCompare(b.zoneName));
  return rows;
}

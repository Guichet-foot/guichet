/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { FondateurReport, type FondateurReportRow } from "@/lib/pdf/fondateur-report";
import { fetchAll } from "@/lib/supabase/paginate";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import React from "react";

const DEMO_ACCOUNT_ID = "aa984bd3-7493-41d3-bad0-7a9c733ba51e";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["fondateur", "super_admin", "president_odcav", "tresorier"].includes(profile.role)) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    const body = await request.json();
    const { from, to, type = "all", zoneId, c3Id, saId } = body as {
      from?: string;
      to?: string;
      type?: string;
      zoneId?: string;
      c3Id?: string;
      saId?: string;
    };

    const adminSupabase = await createAdminClient();

    // Platform settings (odcav_rate)
    const settingsDate = to || new Date().toISOString().split("T")[0];
    const { data: platformData } = await adminSupabase
      .from("platform_settings")
      .select("odcav_rate")
      .lte("effective_date", settingsDate)
      .order("effective_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    const odcavRate: number = platformData?.odcav_rate ?? 0.05;

    const dateStart = from ? new Date(from + "T00:00:00") : new Date("2020-01-01T00:00:00");
    const dateEnd = to ? new Date(to + "T23:59:59.999") : new Date();

    // Dashboard filters (Zone / C3 / Super Admin). A zone or super-admin filter limits the
    // report to those zones only; a C3 filter limits it to that C3 only; no filter = everyone.
    const hasZoneScope = !!(zoneId || saId);
    const includeZones = !c3Id || hasZoneScope;
    const includeC3 = !!c3Id || !hasZoneScope;

    // All zones (excl. demo)
    const { data: zonesData } = await adminSupabase.from("zones").select("id, name, created_by");
    const allZonesNonDemo = ((zonesData || []) as any[]).filter((z) => z.created_by !== DEMO_ACCOUNT_ID);
    let zones = includeZones ? allZonesNonDemo : [];
    if (zoneId) zones = zones.filter((z) => z.id === zoneId);
    else if (saId) zones = zones.filter((z) => z.created_by === saId);
    const zoneMap = new Map<string, string>(zones.map((z) => [z.id as string, z.name as string]));
    const zoneIds = zones.map((z) => z.id as string);

    // All C3 profiles
    const { data: c3Data } = await adminSupabase.from("profiles").select("id, full_name").eq("role", "c3");
    let c3Profiles = (includeC3 ? ((c3Data || []) as { id: string; full_name: string }[]) : []);
    if (c3Id) c3Profiles = c3Profiles.filter((p) => p.id === c3Id);
    const c3Map = new Map<string, string>(c3Profiles.map((p) => [p.id, p.full_name]));
    const c3Ids = c3Profiles.map((p) => p.id);

    // All non-cancelled matches
    const { data: allMatchesData } = await adminSupabase
      .from("matches")
      .select("id, zone_id, c3_account_id")
      .neq("status", "annule");
    const allMatches = (allMatchesData || []) as { id: string; zone_id: string | null; c3_account_id: string | null }[];

    const matchToZone = new Map<string, string>();
    const matchToC3 = new Map<string, string>();
    const zoneMatchIds: string[] = [];
    const c3MatchIds: string[] = [];

    for (const m of allMatches) {
      if (m.zone_id && zoneIds.includes(m.zone_id) && !m.c3_account_id) {
        matchToZone.set(m.id, m.zone_id);
        zoneMatchIds.push(m.id);
      }
      if (m.c3_account_id && c3Ids.includes(m.c3_account_id)) {
        matchToC3.set(m.id, m.c3_account_id);
        c3MatchIds.push(m.id);
      }
    }

    // ── Zone: regular tickets with price ─────────────────────────────
    const zoneRevenue = new Map<string, number>();
    const zoneScanned = new Map<string, number>();

    if (zoneMatchIds.length > 0 && (type === "all" || type === "zone")) {
      const zoneTickets = await fetchAll<any>((from2, to2) =>
        adminSupabase
          .from("tickets")
          .select("match_id, price, status, counts_as_revenue, scanned_at")
          .in("match_id", zoneMatchIds)
          .eq("status", "scanne")
          .gte("scanned_at", dateStart.toISOString())
          .lte("scanned_at", dateEnd.toISOString())
          .range(from2, to2)
      );
      for (const t of zoneTickets) {
        const zId = matchToZone.get(t.match_id as string);
        if (!zId) continue;
        zoneScanned.set(zId, (zoneScanned.get(zId) || 0) + 1);
        if (t.counts_as_revenue) {
          zoneRevenue.set(zId, (zoneRevenue.get(zId) || 0) + (t.price || 0));
        }
      }
    }

    // ── Zone: billeterie scans with price ────────────────────────────
    // Zones that sell through billeterie passes have no regular tickets, so their activity
    // only exists in billeterie_scans. Attributed to a zone by the scan's match (same rule
    // as the dashboard). The scan → ticket join gives billeterie + category for the price.
    if (zoneMatchIds.length > 0 && (type === "all" || type === "zone")) {
      const { data: bilData } = await adminSupabase.from("billeterie").select("id, price, categories");
      const bilInfo = new Map<string, { price: number; cats: { name: string; price: number }[] | null }>();
      ((bilData || []) as any[]).forEach((b) =>
        bilInfo.set(b.id as string, { price: b.price || 0, cats: (b.categories as any) || null })
      );

      // Chunk match ids so the .in() filter never overflows the request URL
      const matchChunks: string[][] = [];
      for (let i = 0; i < zoneMatchIds.length; i += 100) matchChunks.push(zoneMatchIds.slice(i, i + 100));

      const scanChunks = await Promise.all(
        matchChunks.map((ids) =>
          fetchAll<any>((from2, to2) =>
            adminSupabase
              .from("billeterie_scans")
              .select("match_id, ticket:billeterie_tickets(billeterie_id, category_name)")
              .in("match_id", ids)
              .gte("scanned_at", dateStart.toISOString())
              .lte("scanned_at", dateEnd.toISOString())
              .order("id", { ascending: true })
              .range(from2, to2)
          )
        )
      );

      for (const s of scanChunks.flat()) {
        const zId = matchToZone.get(s.match_id as string);
        if (!zId) continue;
        zoneScanned.set(zId, (zoneScanned.get(zId) || 0) + 1);

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
        zoneRevenue.set(zId, (zoneRevenue.get(zId) || 0) + price);
      }
    }

    // ── C3: billeterie scans with price ──────────────────────────────
    const c3Revenue = new Map<string, number>();
    const c3ScannedMap = new Map<string, number>();

    if (c3MatchIds.length > 0 && (type === "all" || type === "c3")) {
      const c3MatchSet = new Set(c3MatchIds);
      const { data: allBilsRaw } = await adminSupabase
        .from("billeterie")
        .select("id, price, match_ids, categories");
      const c3Bils = ((allBilsRaw || []) as any[]).filter((b) =>
        ((b.match_ids as string[]) || []).some((id) => c3MatchSet.has(id))
      );

      if (c3Bils.length > 0) {
        const bilIds = c3Bils.map((b) => b.id as string);
        const bilPriceMap: Record<string, number> = {};
        const bilCatMap: Record<string, { name: string; price: number }[]> = {};
        const bilToC3 = new Map<string, string>();

        c3Bils.forEach((b: any) => {
          bilPriceMap[b.id] = b.price || 0;
          if (b.categories) bilCatMap[b.id] = b.categories;
          for (const mid of ((b.match_ids as string[]) || [])) {
            const c3Id = matchToC3.get(mid);
            if (c3Id && !bilToC3.has(b.id as string)) bilToC3.set(b.id as string, c3Id);
          }
        });

        const allBilMatchIds = [...new Set(
          c3Bils.flatMap((b: any) => (b.match_ids as string[]) || [])
        )];

        const [allBilTickets, bilScans] = await Promise.all([
          fetchAll<any>((from2, to2) =>
            adminSupabase
              .from("billeterie_tickets")
              .select("id, billeterie_id, category_name")
              .in("billeterie_id", bilIds)
              .range(from2, to2)
          ),
          fetchAll<any>((from2, to2) =>
            adminSupabase
              .from("billeterie_scans")
              .select("ticket_id, match_id, scanned_at")
              .in("match_id", allBilMatchIds)
              .gte("scanned_at", dateStart.toISOString())
              .lte("scanned_at", dateEnd.toISOString())
              .range(from2, to2)
          ),
        ]);

        const ticketToBil = new Map<string, string>();
        const ticketToCat = new Map<string, string | null>();
        allBilTickets.forEach((t: any) => {
          ticketToBil.set(t.id as string, t.billeterie_id as string);
          ticketToCat.set(t.id as string, t.category_name ?? null);
        });

        for (const s of bilScans) {
          const bilId = ticketToBil.get(s.ticket_id as string);
          if (!bilId) continue;
          const c3Id = bilToC3.get(bilId);
          if (!c3Id) continue;
          c3ScannedMap.set(c3Id, (c3ScannedMap.get(c3Id) || 0) + 1);
          const catName = ticketToCat.get(s.ticket_id as string);
          const cats = bilCatMap[bilId];
          let price = 0;
          if (cats && catName) {
            const cat = cats.find((c) => c.name === catName);
            price = cat ? cat.price : 0;
          } else {
            price = bilPriceMap[bilId] || 0;
          }
          c3Revenue.set(c3Id, (c3Revenue.get(c3Id) || 0) + price);
        }
      }
    }

    // ── Build rows ────────────────────────────────────────────────────
    const rows: FondateurReportRow[] = [];

    if (type === "all" || type === "zone") {
      for (const [zId, zName] of zoneMap) {
        const scanned = zoneScanned.get(zId) || 0;
        const brutes = zoneRevenue.get(zId) || 0;
        if (scanned === 0 && brutes === 0) continue;
        const commission = Math.round(brutes * odcavRate);
        const frais = scanned * 10;
        rows.push({
          organisateur: zName,
          type: "zone",
          billetsScanned: scanned,
          recettesBrutes: brutes,
          commission,
          frais,
          recetteNette: brutes - commission - frais,
        });
      }
    }

    if (type === "all" || type === "c3") {
      for (const [c3Id, c3Name] of c3Map) {
        const scanned = c3ScannedMap.get(c3Id) || 0;
        const brutes = c3Revenue.get(c3Id) || 0;
        if (scanned === 0 && brutes === 0) continue;
        const commission = Math.round(brutes * odcavRate);
        const frais = scanned * 10;
        rows.push({
          organisateur: c3Name || "C3",
          type: "c3",
          billetsScanned: scanned,
          recettesBrutes: brutes,
          commission,
          frais,
          recetteNette: brutes - commission - frais,
        });
      }
    }

    rows.sort((a, b) => b.recettesBrutes - a.recettesBrutes || a.organisateur.localeCompare(b.organisateur));

    const totals = rows.reduce(
      (acc, r) => ({
        billetsScanned: acc.billetsScanned + r.billetsScanned,
        recettesBrutes: acc.recettesBrutes + r.recettesBrutes,
        commission: acc.commission + r.commission,
        frais: acc.frais + r.frais,
        recetteNette: acc.recetteNette + r.recetteNette,
      }),
      { billetsScanned: 0, recettesBrutes: 0, commission: 0, frais: 0, recetteNette: 0 }
    );

    const basePeriodLabel =
      from && to
        ? `Du ${format(dateStart, "d MMMM yyyy", { locale: fr })} au ${format(dateEnd, "d MMMM yyyy", { locale: fr })}`
        : from
          ? `À partir du ${format(dateStart, "d MMMM yyyy", { locale: fr })}`
          : to
            ? `Jusqu'au ${format(dateEnd, "d MMMM yyyy", { locale: fr })}`
            : "Toutes périodes";

    // Name the scope in the header so the PDF says which account(s) it covers
    const scopeParts: string[] = [];
    if (zoneId) scopeParts.push(allZonesNonDemo.find((z) => z.id === zoneId)?.name || "Zone");
    if (c3Id) scopeParts.push(c3Map.get(c3Id) || "C3");
    if (saId && !zoneId) {
      const { data: saProfile } = await adminSupabase.from("profiles").select("full_name").eq("id", saId).maybeSingle();
      scopeParts.push(`Super Admin : ${saProfile?.full_name || "—"}`);
    }
    const periodLabel = scopeParts.length > 0 ? `${scopeParts.join(" · ")} — ${basePeriodLabel}` : basePeriodLabel;

    const reportData = {
      periodLabel,
      generatedAt: format(new Date(), "dd/MM/yyyy HH:mm", { locale: fr }),
      odcavRate,
      rows,
      totals,
    };

    const buffer = await renderToBuffer(
      React.createElement(FondateurReport, { data: reportData }) as any
    );

    const filename = `rapport-financier${from ? `-${from}` : ""}${to ? `-au-${to}` : ""}.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=${filename}`,
      },
    });
  } catch (err: any) {
    console.error("[reports/fondateur] error:", err);
    return NextResponse.json({ error: err?.message || "Erreur serveur" }, { status: 500 });
  }
}

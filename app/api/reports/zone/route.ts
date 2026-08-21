/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { ZoneReport, type ZoneReportMatch } from "@/lib/pdf/zone-report";
import { fetchAll } from "@/lib/supabase/paginate";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import React from "react";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", user.id)
      .single();

    if (
      !profile ||
      !["super_admin", "admin_zone", "c3", "fondateur", "president_odcav", "tresorier"].includes(
        profile.role
      )
    ) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    const body = await request.json();
    const {
      fromIso,
      toIso,
      zoneId: paramZoneId,
      c3AccountId: paramC3Id,
      matchId: filterMatchId,
    } = body as {
      fromIso: string;
      toIso: string;
      zoneId?: string | null;
      c3AccountId?: string | null;
      matchId?: string | null;
    };

    const adminSupabase = await createAdminClient();
    const dateStart = new Date(fromIso);
    const dateEnd = new Date(toIso);

    const zoneId = paramZoneId || null;
    const c3AccountId = paramC3Id || (profile.role === "c3" ? profile.id : null);

    // Platform settings
    const { data: platformData } = await adminSupabase
      .from("platform_settings")
      .select("odcav_rate")
      .lte("effective_date", toIso.split("T")[0])
      .order("effective_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    const odcavRate: number = platformData?.odcav_rate ?? 0.05;

    // Organisateur name
    let organisateurName = "Organisateur";
    let organisateurType: "zone" | "c3" = "zone";

    if (c3AccountId) {
      organisateurType = "c3";
      const { data: c3Profile } = await adminSupabase
        .from("profiles")
        .select("full_name")
        .eq("id", c3AccountId)
        .single();
      organisateurName = c3Profile?.full_name || "C3";
    } else if (zoneId) {
      const { data: zone } = await adminSupabase
        .from("zones")
        .select("name")
        .eq("id", zoneId)
        .single();
      organisateurName = zone?.name || "Zone";
    }

    // Period label
    const isSameDay =
      dateStart.toISOString().split("T")[0] === dateEnd.toISOString().split("T")[0];
    const periodLabel = isSameDay
      ? `Le ${format(dateStart, "d MMMM yyyy", { locale: fr })}`
      : `Du ${format(dateStart, "d MMMM yyyy", { locale: fr })} au ${format(dateEnd, "d MMMM yyyy", { locale: fr })}`;

    // C3 match IDs (own matches + affiliated zone matches)
    let c3AllMatchIds: string[] | null = null;
    if (c3AccountId) {
      const [c3Matches, c3Zones] = await Promise.all([
        adminSupabase.from("matches").select("id").eq("c3_account_id", c3AccountId),
        adminSupabase.from("zones").select("id").eq("created_by", c3AccountId),
      ]);
      const c3ZoneIds = ((c3Zones.data || []) as any[]).map((z: any) => z.id as string);
      const ids: string[] = ((c3Matches.data || []) as any[]).map((m: any) => m.id as string);
      if (c3ZoneIds.length > 0) {
        const { data: zoneMatchData } = await adminSupabase
          .from("matches")
          .select("id")
          .in("zone_id", c3ZoneIds);
        ids.push(...((zoneMatchData || []) as any[]).map((m: any) => m.id as string));
      }
      c3AllMatchIds = [...new Set(ids)];
    }

    // Matches in period
    let matchesPeriodQuery: any = adminSupabase
      .from("matches")
      .select("id, home_team, away_team, match_date");

    if (filterMatchId) {
      matchesPeriodQuery = matchesPeriodQuery.eq("id", filterMatchId);
    } else {
      matchesPeriodQuery = matchesPeriodQuery
        .gte("match_date", dateStart.toISOString())
        .lte("match_date", dateEnd.toISOString());
    }

    if (c3AllMatchIds !== null) {
      if (c3AllMatchIds.length > 0)
        matchesPeriodQuery = matchesPeriodQuery.in("id", c3AllMatchIds);
      else
        matchesPeriodQuery = matchesPeriodQuery.eq("id", "00000000-0000-0000-0000-000000000000");
    } else if (zoneId) {
      matchesPeriodQuery = matchesPeriodQuery.eq("zone_id", zoneId);
    }

    const { data: matchesInPeriod } = await matchesPeriodQuery;
    const periodMatches = (matchesInPeriod || []) as any[];
    const matchIdsInPeriod = periodMatches.map((m: any) => m.id as string);

    const matchLabelMap = new Map<string, string>();
    const matchDateMap = new Map<string, string>();
    periodMatches.forEach((m: any) => {
      matchLabelMap.set(m.id, `${m.home_team} vs ${m.away_team}`);
      matchDateMap.set(m.id, m.match_date ? format(new Date(m.match_date), "dd/MM/yy") : "");
    });

    // All scope match IDs (for ticket/billeterie queries)
    let allScopeMatchIds: string[];
    if (filterMatchId) {
      allScopeMatchIds = matchIdsInPeriod;
    } else if (c3AllMatchIds !== null) {
      allScopeMatchIds = c3AllMatchIds;
    } else if (zoneId) {
      const { data: allZoneMatchData } = await adminSupabase
        .from("matches")
        .select("id")
        .eq("zone_id", zoneId);
      allScopeMatchIds = ((allZoneMatchData || []) as any[]).map((m: any) => m.id as string);
    } else {
      allScopeMatchIds = matchIdsInPeriod;
    }

    // ── Regular tickets ──────────────────────────────────────────────────────
    let allScopeTickets: any[] = [];
    if (allScopeMatchIds.length > 0) {
      allScopeTickets = await fetchAll<any>((from, to) =>
        adminSupabase
          .from("tickets")
          .select("price, status, counts_as_revenue, match_id, scanned_at")
          .in("match_id", allScopeMatchIds)
          .range(from, to)
      );
    }

    const dateStartMs = dateStart.getTime();
    const dateEndMs = dateEnd.getTime();

    // ALL scanned in period (for frais)
    const periodAllScanned = filterMatchId
      ? allScopeTickets.filter((t: any) => t.status === "scanne")
      : allScopeTickets.filter((t: any) => {
          if (t.status !== "scanne" || !t.scanned_at) return false;
          const ms = new Date(t.scanned_at as string).getTime();
          return ms >= dateStartMs && ms <= dateEndMs;
        });

    // Revenue-counting scanned in period
    const periodRevScanned = periodAllScanned.filter((t: any) => t.counts_as_revenue);

    const matchRegScanned = new Map<string, number>();
    const matchRegRevenue = new Map<string, number>();
    periodAllScanned.forEach((t: any) => {
      const mid = t.match_id as string;
      matchRegScanned.set(mid, (matchRegScanned.get(mid) || 0) + 1);
    });
    periodRevScanned.forEach((t: any) => {
      const mid = t.match_id as string;
      matchRegRevenue.set(mid, (matchRegRevenue.get(mid) || 0) + (t.price || 0));
    });

    const totalRegScanned = periodAllScanned.length;
    const totalRegRevenue = periodRevScanned.reduce((s: number, t: any) => s + (t.price || 0), 0);

    // ── Billeterie ───────────────────────────────────────────────────────────
    let bilRevenue = 0;
    let bilScanned = 0;
    const matchBilRevenue = new Map<string, number>();
    const matchBilScanned = new Map<string, number>();

    {
      const scanMatchIds = c3AllMatchIds !== null ? c3AllMatchIds : allScopeMatchIds;
      if (scanMatchIds.length > 0) {
        const scanMatchIdSet = new Set(scanMatchIds);

        const { data: allBilsRaw } = await adminSupabase
          .from("billeterie")
          .select("id, price, match_ids, categories");
        const zoneBils = ((allBilsRaw || []) as any[]).filter((b: any) =>
          ((b.match_ids as string[]) || []).some((id) => scanMatchIdSet.has(id))
        );
        const zoneBilIds = zoneBils.map((b: any) => b.id as string);

        const bilPriceMap: Record<string, number> = {};
        const bilCatMap: Record<string, Array<{ name: string; price: number }>> = {};
        zoneBils.forEach((b: any) => {
          bilPriceMap[b.id] = b.price || 0;
          if (b.categories) bilCatMap[b.id] = b.categories;
        });

        if (zoneBilIds.length > 0) {
          const [allBilTickets, periodBilScans] = await Promise.all([
            fetchAll<any>((from, to) =>
              adminSupabase
                .from("billeterie_tickets")
                .select("id, billeterie_id, category_name")
                .in("billeterie_id", zoneBilIds)
                .range(from, to)
            ),
            fetchAll<any>((from, to) => {
              const q = adminSupabase
                .from("billeterie_scans")
                .select("ticket_id, match_id")
                .in("match_id", [...scanMatchIds]);
              return filterMatchId
                ? q.range(from, to)
                : q
                    .gte("scanned_at", dateStart.toISOString())
                    .lte("scanned_at", dateEnd.toISOString())
                    .range(from, to);
            }),
          ]);

          const ticketToBilId: Record<string, string> = {};
          const ticketToCat: Record<string, string | null> = {};
          allBilTickets.forEach((t: any) => {
            ticketToBilId[t.id] = t.billeterie_id;
            ticketToCat[t.id] = t.category_name ?? null;
          });

          bilScanned = periodBilScans.length;

          for (const s of periodBilScans) {
            const bilId = ticketToBilId[s.ticket_id as string];
            if (!bilId) continue;
            const mid = s.match_id as string;
            matchBilScanned.set(mid, (matchBilScanned.get(mid) || 0) + 1);

            const catName = ticketToCat[s.ticket_id as string];
            const cats = bilCatMap[bilId];
            let price = 0;
            if (cats && catName) {
              const cat = cats.find((c) => c.name === catName);
              price = cat ? cat.price : 0;
            } else {
              price = bilPriceMap[bilId] || 0;
            }
            bilRevenue += price;
            matchBilRevenue.set(mid, (matchBilRevenue.get(mid) || 0) + price);
          }
        }
      }
    }

    // ── Totals ───────────────────────────────────────────────────────────────
    const totalRevenue = totalRegRevenue + bilRevenue;
    const totalScanned = totalRegScanned + bilScanned;
    const odcavCommission = Math.round(totalRevenue * odcavRate);
    const fraisPlateformePeriod = totalScanned * 10;
    const recetteNette = totalRevenue - odcavCommission - fraisPlateformePeriod;

    // ── Per-match rows ────────────────────────────────────────────────────────
    const matchRows: ZoneReportMatch[] = matchIdsInPeriod
      .map((mid) => ({
        label: matchLabelMap.get(mid) || mid,
        date: matchDateMap.get(mid) || "",
        scanned: (matchRegScanned.get(mid) || 0) + (matchBilScanned.get(mid) || 0),
        revenue: (matchRegRevenue.get(mid) || 0) + (matchBilRevenue.get(mid) || 0),
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const reportData = {
      organisateurName,
      organisateurType,
      periodLabel,
      generatedAt: format(new Date(), "dd/MM/yyyy HH:mm", { locale: fr }),
      odcavRate,
      totalScanned,
      totalRevenue,
      odcavCommission,
      fraisPlateformePeriod,
      recetteNette,
      matches: matchRows,
    };

    const buffer = await renderToBuffer(
      React.createElement(ZoneReport, { data: reportData }) as any
    );

    const safeName = organisateurName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, "-");
    const filename = `rapport-financier-${safeName}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error("[reports/zone] error:", err);
    return NextResponse.json({ error: err?.message || "Erreur serveur" }, { status: 500 });
  }
}

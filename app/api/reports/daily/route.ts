/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { DailyReport } from "@/lib/pdf/daily-report";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/constants";
import React from "react";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, zone_id, zone:zones!profiles_zone_id_fkey(name)")
      .eq("id", user.id)
      .single();

    if (!profile || !["admin_zone", "super_admin", "c3"].includes(profile.role)) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    const body = await request.json();
    const { date, zoneId: bodyZoneId, c3AccountId } = body;

    const effectiveZoneId: string | null =
      profile.role === "admin_zone" ? profile.zone_id : (bodyZoneId || null);
    const effectiveC3Id: string | null =
      profile.role === "c3" ? (c3AccountId || user.id) : null;

    const adminSupabase = await createAdminClient();

    // Paramètres plateforme effectifs à cette date
    const { data: platformData } = await adminSupabase
      .from("platform_settings")
      .select("fee_per_block, odcav_rate")
      .lte("effective_date", date)
      .order("effective_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const fraisPlateforme = platformData?.fee_per_block ?? 5000;
    const odcavRate = platformData?.odcav_rate ?? 0.05;

    // Pour C3 : récupérer tous les match IDs visibles (propres + communaux non assignés)
    let c3AllMatchIds: string[] | null = null;
    if (effectiveC3Id) {
      const [ownRes, communalRes] = await Promise.all([
        adminSupabase.from("matches").select("id").eq("c3_account_id", effectiveC3Id),
        adminSupabase.from("matches").select("id").eq("is_direct", true).eq("match_type", "Match Communal").is("c3_account_id", null),
      ]);
      c3AllMatchIds = [...new Set([
        ...(ownRes.data || []).map((m: any) => m.id as string),
        ...(communalRes.data || []).map((m: any) => m.id as string),
      ])];
    }
    const c3MatchSet = c3AllMatchIds ? new Set(c3AllMatchIds) : null;

    // Tickets du jour (sans match_time qui n'existe pas)
    const { data: tickets } = await supabase
      .from("tickets")
      .select("price, match_id, match:matches(home_team, away_team, zone_id, c3_account_id, match_date)")
      .gte("sold_at", `${date}T00:00:00`)
      .lte("sold_at", `${date}T23:59:59`)
      .eq("counts_as_revenue", true) as { data: any[] | null };

    const filteredTickets = c3MatchSet
      ? tickets?.filter((t: any) => c3MatchSet.has(t.match_id))
      : effectiveZoneId
        ? tickets?.filter((t: any) => t.match?.zone_id === effectiveZoneId)
        : tickets;

    const totalRevenue = filteredTickets?.reduce((s: number, t: any) => s + t.price, 0) || 0;

    // Recettes par match
    const revenueMap: Record<string, {
      homeTeam: string; awayTeam: string;
      matchDate?: string;
      sold: number; revenue: number;
    }> = {};
    filteredTickets?.forEach((t: any) => {
      if (!t.match) return;
      if (!revenueMap[t.match_id]) {
        revenueMap[t.match_id] = {
          homeTeam: t.match.home_team,
          awayTeam: t.match.away_team,
          matchDate: t.match.match_date || undefined,
          sold: 0,
          revenue: 0,
        };
      }
      revenueMap[t.match_id].sold++;
      revenueMap[t.match_id].revenue += t.price;
    });

    // Dépenses du jour
    let expensesQuery = supabase
      .from("expenses")
      .select("label, category, amount")
      .eq("expense_date", date)
      .order("category");
    if (effectiveC3Id) {
      expensesQuery = (expensesQuery as any).eq("c3_account_id", effectiveC3Id);
    } else if (effectiveZoneId) {
      expensesQuery = expensesQuery.eq("zone_id", effectiveZoneId);
    }

    const { data: expenses } = await expensesQuery as { data: any[] | null };
    const totalExpenses = expenses?.reduce((s: number, e: any) => s + e.amount, 0) || 0;

    // Nom de la zone / organisation
    let zoneName: string = effectiveC3Id ? "C3" : ((profile as any).zone?.name || "Toutes zones");
    if (profile.role === "super_admin" && effectiveZoneId) {
      const { data: zone } = await supabase
        .from("zones").select("name").eq("id", effectiveZoneId).single();
      if (zone) zoneName = zone.name;
    }

    // Infos ODCAV
    let odcavSettingsId = user.id;
    if (profile.role === "admin_zone" && profile.zone_id) {
      const { data: zoneOwner } = await adminSupabase
        .from("zones").select("created_by").eq("id", profile.zone_id).maybeSingle();
      if (zoneOwner?.created_by) odcavSettingsId = zoneOwner.created_by;
    }
    const { data: odcavData } = await adminSupabase
      .from("odcav_settings")
      .select("logo_url, nom, adresse, president, telephone, email")
      .eq("id", odcavSettingsId)
      .maybeSingle();
    const odcavInfo = odcavData
      ? {
          logoUrl: odcavData.logo_url || undefined,
          nom: odcavData.nom || undefined,
          adresse: odcavData.adresse || undefined,
          president: odcavData.president || undefined,
          telephone: odcavData.telephone || undefined,
          email: odcavData.email || undefined,
        }
      : undefined;

    const odcavCommission = Math.round(totalRevenue * odcavRate);
    const netZone = totalRevenue - totalExpenses - odcavCommission - fraisPlateforme;

    const reportData = {
      zoneName,
      date: format(new Date(date), "d MMMM yyyy", { locale: fr }),
      generatedAt: format(new Date(), "dd/MM/yyyy HH:mm", { locale: fr }),
      totalRevenue,
      totalExpenses,
      odcavCommission,
      odcavRate,
      fraisPlateforme,
      netZone,
      revenueByMatch: Object.values(revenueMap),
      odcavInfo,
      expenses: (expenses || []).map((e: any) => ({
        label: e.label,
        categoryKey: e.category as string,
        category: EXPENSE_CATEGORY_LABELS[e.category as string] || e.category,
        amount: e.amount,
      })),
    };

    const buffer = await renderToBuffer(
      React.createElement(DailyReport, { data: reportData }) as any
    );

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=fiche-recettes-${date}.pdf`,
      },
    });
  } catch (err: any) {
    console.error("[daily/route] error:", err);
    return NextResponse.json({ error: err?.message || "Erreur serveur" }, { status: 500 });
  }
}

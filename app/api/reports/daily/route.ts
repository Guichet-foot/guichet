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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, zone_id, zone:zones!profiles_zone_id_fkey(name)")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin_zone", "super_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const body = await request.json();
  const { date, zoneId: bodyZoneId } = body;

  const effectiveZoneId: string | null =
    profile.role === "admin_zone" ? profile.zone_id : (bodyZoneId || null);

  // Récupérer les paramètres plateforme effectifs à cette date
  const adminSupabase = await createAdminClient();
  const { data: platformData } = await adminSupabase
    .from("platform_settings")
    .select("frais_plateforme, odcav_rate")
    .lte("effective_date", date)
    .order("effective_date", { ascending: false })
    .limit(1)
    .single();

  const fraisPlateforme = platformData?.frais_plateforme ?? 5000;
  const odcavRate = platformData?.odcav_rate ?? 0.05;

  // Tickets du jour
  const { data: tickets } = await supabase
    .from("tickets")
    .select("price, match_id, match:matches(home_team, away_team, zone_id)")
    .gte("sold_at", `${date}T00:00:00`)
    .lte("sold_at", `${date}T23:59:59`)
    .neq("status", "annule") as { data: any[] | null };

  const filteredTickets = effectiveZoneId
    ? tickets?.filter((t: any) => t.match?.zone_id === effectiveZoneId)
    : tickets;

  const totalRevenue = filteredTickets?.reduce((s: number, t: any) => s + t.price, 0) || 0;

  // Recettes par match
  const revenueMap: Record<string, { teams: string; sold: number; revenue: number }> = {};
  filteredTickets?.forEach((t: any) => {
    if (!t.match) return;
    if (!revenueMap[t.match_id]) {
      revenueMap[t.match_id] = {
        teams: `${t.match.home_team} vs ${t.match.away_team}`,
        sold: 0, revenue: 0,
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
  if (effectiveZoneId) expensesQuery = expensesQuery.eq("zone_id", effectiveZoneId);

  const { data: expenses } = await expensesQuery as { data: any[] | null };
  const totalExpenses = expenses?.reduce((s: number, e: any) => s + e.amount, 0) || 0;

  // Nom de la zone
  let zoneName: string = (profile as any).zone?.name || "Toutes zones";
  if (profile.role === "super_admin" && effectiveZoneId) {
    const { data: zone } = await supabase
      .from("zones").select("name").eq("id", effectiveZoneId).single();
    if (zone) zoneName = zone.name;
  }

  const odcavCommission = Math.round(totalRevenue * odcavRate);
  const netZone = totalRevenue - totalExpenses - odcavCommission - fraisPlateforme;

  const reportData = {
    zoneName,
    date: format(new Date(date), "EEEE d MMMM yyyy", { locale: fr }),
    generatedAt: format(new Date(), "dd/MM/yyyy HH:mm", { locale: fr }),
    totalRevenue,
    totalExpenses,
    odcavCommission,
    odcavRate,
    fraisPlateforme,
    netZone,
    revenueByMatch: Object.values(revenueMap),
    expenses: (expenses || []).map((e: any) => ({
      label: e.label,
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
      "Content-Disposition": `attachment; filename=bilan-journalier-${date}.pdf`,
    },
  });
}

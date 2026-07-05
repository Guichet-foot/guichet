/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { FinancialReport } from "@/lib/pdf/financial-report";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/constants";
import React from "react";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, zone_id, zone:zones!profiles_zone_id_fkey(name)")
    .eq("id", user.id)
    .single();

  if (
    !profile ||
    !["admin_zone", "super_admin"].includes(profile.role)
  ) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const body = await request.json();
  const { startDate, endDate, reportType, matchId } = body;

  const zoneId =
    profile.role === "admin_zone" ? profile.zone_id : null;

  // Infos ODCAV pour le PDF
  const adminSupabase = await createAdminClient();
  const { data: odcavData } = await adminSupabase
    .from("odcav_settings")
    .select("logo_url, nom, adresse, president, telephone, email")
    .eq("id", "global")
    .single();
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

  // Fetch tickets (all statuses for accurate printed/unsold/validated counts)
  let ticketsQuery = supabase
    .from("tickets")
    .select(
      "price, status, match_id, sold_at, match:matches(home_team, away_team, match_date, zone_id)"
    )
    .gte("sold_at", `${startDate}T00:00:00`)
    .lte("sold_at", `${endDate}T23:59:59`);

  if (matchId) {
    ticketsQuery = ticketsQuery.eq("match_id", matchId);
  }

  const { data: tickets } = await ticketsQuery as { data: any[] | null };

  const filteredTickets = (zoneId
    ? tickets?.filter((t: any) => t.match?.zone_id === zoneId)
    : tickets) || [];

  // Revenue by match
  const revenueMap: Record<
    string,
    { teams: string; date: string; printed: number; unsold: number; validated: number; revenue: number }
  > = {};

  filteredTickets.forEach((t: any) => {
    if (!t.match) return;
    if (!revenueMap[t.match_id]) {
      revenueMap[t.match_id] = {
        teams: `${t.match.home_team} vs ${t.match.away_team}`,
        date: format(new Date(t.match.match_date), "dd/MM/yyyy", { locale: fr }),
        printed: 0, unsold: 0, validated: 0, revenue: 0,
      };
    }
    revenueMap[t.match_id].printed++;
    if (t.status === "annule") {
      revenueMap[t.match_id].unsold++;
    } else {
      revenueMap[t.match_id].revenue += t.price;
    }
    if (t.status === "scanne") {
      revenueMap[t.match_id].validated++;
    }
  });

  const totalRevenue = filteredTickets
    .filter((t: any) => t.status !== "annule")
    .reduce((sum: number, t: any) => sum + t.price, 0);

  // Fetch expenses
  let expensesQuery = supabase
    .from("expenses")
    .select(
      "*, match:matches(home_team, away_team)"
    )
    .gte("expense_date", startDate)
    .lte("expense_date", endDate)
    .order("expense_date");

  if (zoneId) {
    expensesQuery = expensesQuery.eq("zone_id", zoneId);
  }

  if (matchId) {
    expensesQuery = expensesQuery.eq("match_id", matchId);
  }

  const { data: expenses } = await expensesQuery as { data: any[] | null };

  const totalExpenses =
    expenses?.reduce((sum: number, e: any) => sum + e.amount, 0) || 0;

  const reportData = {
    zoneName: (profile as any).zone?.name || "Toutes zones",
    startDate: format(new Date(startDate), "dd/MM/yyyy", { locale: fr }),
    endDate: format(new Date(endDate), "dd/MM/yyyy", { locale: fr }),
    reportType,
    generatedAt: format(new Date(), "dd/MM/yyyy HH:mm", { locale: fr }),
    totalRevenue,
    totalExpenses,
    revenueByMatch: Object.values(revenueMap),
    odcavInfo,
    expenses:
      expenses?.map((e) => ({
        date: format(new Date(e.expense_date), "dd/MM/yyyy", { locale: fr }),
        label: e.label,
        category:
          EXPENSE_CATEGORY_LABELS[e.category as string] || e.category,
        match: e.match
          ? `${e.match.home_team} vs ${e.match.away_team}`
          : "Global zone",
        amount: e.amount,
      })) || [],
  };

  const buffer = await renderToBuffer(
    React.createElement(FinancialReport, { data: reportData }) as any
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=rapport-${reportType}-${startDate}.pdf`,
    },
  });
}

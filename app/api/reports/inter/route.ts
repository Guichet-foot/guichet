/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { FinancialReport } from "@/lib/pdf/financial-report";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import React from "react";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, created_by_admin")
    .eq("id", user.id)
    .single();

  if (!profile || !["super_admin", "president_odcav", "tresorier"].includes(profile.role)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const body = await request.json();
  const { matchType, reportType, matchId, startDate, endDate } = body as {
    matchType: "Match Communal" | "Match Départemental";
    reportType: string;
    matchId: string | null;
    startDate: string | null;
    endDate: string | null;
  };

  const adminClient = await createAdminClient();

  // ODCAV isolation
  const ownerId = (profile.role === "tresorier" && (profile as any).created_by_admin)
    ? (profile as any).created_by_admin as string : user.id;
  const { data: subAdmins } = await adminClient.from("profiles").select("id").eq("created_by_admin", ownerId);
  const creatorIds = [ownerId, ...((subAdmins || []) as any[]).map((p: any) => p.id as string)];

  // ODCAV info for PDF header
  const { data: odcavData } = await adminClient
    .from("odcav_settings")
    .select("logo_url, nom, adresse, president, telephone, email")
    .eq("id", ownerId)
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

  // Fetch inter-zone matches for this ODCAV
  let matchQuery = adminClient
    .from("matches")
    .select("id, home_team, away_team, match_date")
    .eq("match_type", matchType)
    .is("zone_id", null)
    .in("created_by", creatorIds)
    .order("match_date", { ascending: true });

  if (matchId) {
    matchQuery = matchQuery.eq("id", matchId);
  } else if (startDate && endDate) {
    matchQuery = matchQuery
      .gte("match_date", `${startDate}T00:00:00`)
      .lte("match_date", `${endDate}T23:59:59`);
  }

  const { data: matches } = await matchQuery;
  const matchIds = (matches || []).map((m: any) => m.id as string);
  const matchInfoMap: Record<string, { teams: string; date: string }> = {};
  (matches || []).forEach((m: any) => {
    matchInfoMap[m.id] = {
      teams: `${m.home_team} vs ${m.away_team}`,
      date: format(new Date(m.match_date), "dd/MM/yyyy", { locale: fr }),
    };
  });

  // Fetch tickets for those matches
  let tickets: any[] = [];
  if (matchIds.length > 0) {
    const { data: t } = await adminClient
      .from("tickets")
      .select("match_id, price, status, bloc_printed, counts_as_revenue")
      .in("match_id", matchIds);
    tickets = t || [];
  }

  // Revenue by match
  const revenueMap: Record<string, { teams: string; date: string; printed: number; unsold: number; validated: number; revenue: number; matchExpenses: number; solde: number }> = {};
  tickets.forEach((t: any) => {
    const info = matchInfoMap[t.match_id];
    if (!info) return;
    if (!revenueMap[t.match_id]) {
      revenueMap[t.match_id] = { ...info, printed: 0, unsold: 0, validated: 0, revenue: 0, matchExpenses: 0, solde: 0 };
    }
    if (t.bloc_printed) revenueMap[t.match_id].printed++;
    if (t.status === "annule") revenueMap[t.match_id].unsold++;
    if (t.status === "scanne") {
      revenueMap[t.match_id].validated++;
      if (t.counts_as_revenue) revenueMap[t.match_id].revenue += t.price;
    }
  });
  Object.values(revenueMap).forEach((r) => { r.solde = r.revenue - r.matchExpenses; });

  const totalRevenue = tickets
    .filter((t: any) => t.counts_as_revenue && t.status === "scanne")
    .reduce((s: number, t: any) => s + t.price, 0);

  // Date range label for report header
  const periodLabel = matchId
    ? (matchInfoMap[matchId]?.teams || "Match")
    : startDate && endDate
      ? `${format(new Date(startDate), "dd/MM/yyyy", { locale: fr })} – ${format(new Date(endDate), "dd/MM/yyyy", { locale: fr })}`
      : "Tous les matchs";

  const typeLabel = matchType === "Match Communal" ? "Matchs Communaux" : "Matchs Départementaux";

  const reportData = {
    zoneName: `${typeLabel} — ${odcavData?.nom || "ODCAV"}`,
    startDate: periodLabel,
    endDate: periodLabel,
    reportType: reportType === "par_match" ? "complet" : reportType,
    generatedAt: format(new Date(), "dd/MM/yyyy HH:mm", { locale: fr }),
    totalRevenue,
    totalExpenses: 0,
    revenueByMatch: Object.values(revenueMap),
    expenses: [],
    odcavInfo,
  };

  const buffer = await renderToBuffer(
    React.createElement(FinancialReport, { data: reportData }) as any
  );

  const filename = `rapport-${matchType === "Match Communal" ? "communal" : "departemental"}-${startDate || "selection"}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=${filename}`,
    },
  });
}

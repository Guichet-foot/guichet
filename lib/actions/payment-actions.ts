"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, createAdminClient } from "@/lib/supabase/server";

export interface PaymentStatus {
  isPaid: boolean;
  validUntil?: string;
  amount: number;
  zoneId: string | null;
  zoneName: string;
  userRole: string;
}

export async function checkZonePayment(): Promise<PaymentStatus> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const empty: PaymentStatus = { isPaid: false, amount: 0, zoneId: null, zoneName: "", userRole: "" };
  if (!user) return empty;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, zone_id, zone:zones!profiles_zone_id_fkey(name)")
    .eq("id", user.id)
    .single();

  if (!profile) return empty;

  // super_admin et fondateur ne paient pas
  if (["super_admin", "fondateur"].includes(profile.role)) {
    return { isPaid: true, amount: 0, zoneId: profile.zone_id, zoneName: (profile as any).zone?.name || "", userRole: profile.role };
  }

  const zoneId = profile.zone_id;
  if (!zoneId) return { ...empty, userRole: profile.role };

  const adminClient = await createAdminClient();

  // Vérifier un paiement valide
  const now = new Date().toISOString();
  const { data: payment } = await adminClient
    .from("zone_daily_payments")
    .select("valid_until")
    .eq("zone_id", zoneId)
    .eq("status", "success")
    .gte("valid_until", now)
    .order("valid_until", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Récupérer le montant actuel des frais plateforme
  const today = new Date().toISOString().split("T")[0];
  const { data: platformData } = await adminClient
    .from("platform_settings")
    .select("frais_plateforme")
    .lte("effective_date", today)
    .order("effective_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    isPaid: !!payment,
    validUntil: payment?.valid_until,
    amount: platformData?.frais_plateforme ?? 5000,
    zoneId,
    zoneName: (profile as any).zone?.name || "",
    userRole: profile.role,
  };
}

export async function initiatePaytechPayment(): Promise<{ redirectUrl?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, zone_id, zone:zones!profiles_zone_id_fkey(name)")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin_zone") {
    return { error: "Seul l'administrateur de zone peut effectuer ce paiement" };
  }

  const zoneId = profile.zone_id;
  if (!zoneId) return { error: "Zone non configurée pour ce compte" };

  const adminClient = await createAdminClient();

  // Vérifier qu'il n'existe pas déjà un paiement valide
  const now = new Date().toISOString();
  const { data: existing } = await adminClient
    .from("zone_daily_payments")
    .select("valid_until")
    .eq("zone_id", zoneId)
    .eq("status", "success")
    .gte("valid_until", now)
    .limit(1)
    .maybeSingle();
  if (existing) return { error: "La zone est déjà activée pour les prochaines 24h" };

  // Récupérer le montant
  const today = new Date().toISOString().split("T")[0];
  const { data: platformData } = await adminClient
    .from("platform_settings")
    .select("frais_plateforme")
    .lte("effective_date", today)
    .order("effective_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const amount = platformData?.frais_plateforme ?? 5000;

  const refCommand = `GF-${zoneId.split("-")[0].toUpperCase()}-${today}-${Date.now()}`;
  const zoneName = (profile as any).zone?.name || "Zone";

  // Enregistrer le paiement en attente
  const { error: insertError } = await adminClient
    .from("zone_daily_payments")
    .insert({ zone_id: zoneId, ref_command: refCommand, amount, status: "pending" });
  if (insertError) return { error: "Erreur lors de la création du paiement" };

  const apiKey = process.env.PAYTECH_API_KEY;
  const apiSecret = process.env.PAYTECH_API_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://guichet-pi.vercel.app";

  if (!apiKey || !apiSecret) {
    return { error: "Paiement non configuré. Contactez le fondateur." };
  }

  const customField = JSON.stringify({ zone_id: zoneId, ref_command: refCommand });

  try {
    const response = await fetch("https://paytech.sn/api/payment/request-payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "API_KEY": apiKey,
        "API_SECRET": apiSecret,
      },
      body: JSON.stringify({
        item_name: "Frais journaliers Guichet Foot",
        item_price: amount,
        currency: "XOF",
        ref_command: refCommand,
        command_name: `Activation Zone ${zoneName} - ${today}`,
        env: process.env.PAYTECH_ENV || "prod",
        ipn_url: `${appUrl}/api/payment/ipn`,
        success_url: `${appUrl}/paiement/success?ref=${encodeURIComponent(refCommand)}`,
        cancel_url: `${appUrl}/paiement/cancel`,
        custom_field: customField,
      }),
    });

    const data = await response.json();

    if (data.success !== 1 || !data.redirect_url) {
      await adminClient
        .from("zone_daily_payments")
        .update({ status: "failed" })
        .eq("ref_command", refCommand);
      return { error: "Erreur Paytech. Réessayez ou contactez le support." };
    }

    // Enregistrer le token Paytech
    if (data.token) {
      await adminClient
        .from("zone_daily_payments")
        .update({ paytech_token: data.token })
        .eq("ref_command", refCommand);
    }

    return { redirectUrl: data.redirect_url };
  } catch {
    await adminClient
      .from("zone_daily_payments")
      .update({ status: "failed" })
      .eq("ref_command", refCommand);
    return { error: "Erreur de connexion à Paytech. Vérifiez votre connexion." };
  }
}

export async function getPaymentByRef(refCommand: string): Promise<{ status: string; validUntil?: string } | null> {
  const adminClient = await createAdminClient();
  const { data } = await adminClient
    .from("zone_daily_payments")
    .select("status, valid_until")
    .eq("ref_command", refCommand)
    .maybeSingle();
  if (!data) return null;
  return { status: data.status, validUntil: data.valid_until };
}

export interface PaymentHistoryItem {
  id: string;
  refCommand: string;
  amount: number;
  status: string;
  paymentMethod: string | null;
  paidAt: string | null;
  validUntil: string | null;
  createdAt: string;
}

export async function getZonePaymentHistory(): Promise<{ items: PaymentHistoryItem[]; zoneId: string | null; zoneName: string; userRole: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { items: [], zoneId: null, zoneName: "", userRole: "" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, zone_id, zone:zones!profiles_zone_id_fkey(name)")
    .eq("id", user.id)
    .single();

  if (!profile) return { items: [], zoneId: null, zoneName: "", userRole: "" };

  const zoneId = profile.zone_id;
  const zoneName = (profile as any).zone?.name || "";

  if (!zoneId) return { items: [], zoneId: null, zoneName, userRole: profile.role };

  const adminClient = await createAdminClient();
  const { data } = await adminClient
    .from("zone_daily_payments")
    .select("id, ref_command, amount, status, payment_method, paid_at, valid_until, created_at")
    .eq("zone_id", zoneId)
    .order("created_at", { ascending: false })
    .limit(30);

  return {
    items: (data || []).map((r: any) => ({
      id: r.id,
      refCommand: r.ref_command,
      amount: r.amount,
      status: r.status,
      paymentMethod: r.payment_method,
      paidAt: r.paid_at,
      validUntil: r.valid_until,
      createdAt: r.created_at,
    })),
    zoneId,
    zoneName,
    userRole: profile.role,
  };
}

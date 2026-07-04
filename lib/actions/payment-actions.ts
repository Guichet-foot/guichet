"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, createAdminClient } from "@/lib/supabase/server";

// ─── Activation manuelle par le fondateur (paiement en espèces) ───────────────
export async function manualActivateZone(
  zoneId: string,
  amount: number,
  durationHours: number
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "fondateur") {
    return { error: "Seul le fondateur peut effectuer une activation manuelle" };
  }

  const adminClient = await createAdminClient();
  const now = new Date();
  const validUntil = new Date(now.getTime() + durationHours * 60 * 60 * 1000);
  const today = now.toISOString().split("T")[0];
  const refCommand = `GF-CASH-${zoneId.split("-")[0].toUpperCase()}-${today}-${Date.now()}`;

  const { error } = await adminClient
    .from("zone_daily_payments")
    .insert({
      zone_id: zoneId,
      ref_command: refCommand,
      amount,
      status: "success",
      payment_method: "cash",
      paid_at: now.toISOString(),
      valid_until: validUntil.toISOString(),
    });

  if (error) return { error: "Erreur lors de l'activation : " + error.message };
  return { success: true };
}

// ─── Désactivation manuelle d'une billetterie (fondateur uniquement) ─────────
export async function deactivateZoneBilling(
  paymentId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "fondateur") {
    return { error: "Seul le fondateur peut désactiver une billetterie" };
  }

  const adminClient = await createAdminClient();
  const { error } = await adminClient
    .from("zone_daily_payments")
    .update({ valid_until: new Date().toISOString() })
    .eq("id", paymentId)
    .eq("status", "success");

  if (error) return { error: "Erreur lors de la désactivation : " + error.message };
  return { success: true };
}

// ─── Vérifier le paiement d'une zone spécifique (par ID) ──────────────────────
export async function checkZonePaymentById(zoneId: string): Promise<{
  isPaid: boolean; validUntil?: string; amount: number; zoneName: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { isPaid: false, amount: 0, zoneName: "" };

  const adminClient = await createAdminClient();

  const { data: zone } = await adminClient.from("zones").select("name").eq("id", zoneId).single();
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
    zoneName: zone?.name || "",
  };
}

// ─── Initier un paiement Paytech pour une zone spécifique (super_admin / admin_zone) ─
export async function initiatePaytechPaymentForZone(zoneId: string): Promise<{ redirectUrl?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, zone_id")
    .eq("id", user.id)
    .single();
  if (!profile) return { error: "Profil introuvable" };

  // admin_zone ne peut payer que pour sa propre zone
  if (profile.role === "admin_zone" && profile.zone_id !== zoneId) {
    return { error: "Vous ne pouvez activer que votre propre zone" };
  }
  if (!["admin_zone", "super_admin", "fondateur"].includes(profile.role)) {
    return { error: "Non autorisé" };
  }

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
  if (existing) return { error: "La billetterie de cette zone est déjà activée" };

  const today = new Date().toISOString().split("T")[0];
  const { data: platformData } = await adminClient
    .from("platform_settings")
    .select("frais_plateforme")
    .lte("effective_date", today)
    .order("effective_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const amount = platformData?.frais_plateforme ?? 5000;

  const { data: zone } = await adminClient.from("zones").select("name").eq("id", zoneId).single();
  const zoneName = zone?.name || "Zone";

  const refCommand = `GF-${zoneId.split("-")[0].toUpperCase()}-${today}-${Date.now()}`;

  const { error: insertError } = await adminClient
    .from("zone_daily_payments")
    .insert({ zone_id: zoneId, ref_command: refCommand, amount, status: "pending" });
  if (insertError) return { error: "Erreur lors de la création du paiement" };

  const apiKey = process.env.PAYTECH_API_KEY;
  const apiSecret = process.env.PAYTECH_API_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://guichet-pi.vercel.app";

  if (!apiKey || !apiSecret) return { error: "Paiement non configuré. Contactez le fondateur." };

  try {
    const response = await fetch("https://paytech.sn/api/payment/request-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json", "API_KEY": apiKey, "API_SECRET": apiSecret },
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
        custom_field: JSON.stringify({ zone_id: zoneId, ref_command: refCommand }),
      }),
    });
    const data = await response.json();
    if (data.success !== 1 || !data.redirect_url) {
      await adminClient.from("zone_daily_payments").update({ status: "failed" }).eq("ref_command", refCommand);
      return { error: "Erreur Paytech. Réessayez." };
    }
    if (data.token) {
      await adminClient.from("zone_daily_payments").update({ paytech_token: data.token }).eq("ref_command", refCommand);
    }
    return { redirectUrl: data.redirect_url };
  } catch {
    await adminClient.from("zone_daily_payments").update({ status: "failed" }).eq("ref_command", refCommand);
    return { error: "Erreur de connexion à Paytech." };
  }
}

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

// ─── Historique global (super_admin) ──────────────────────────────────────────
export interface GlobalPaymentHistoryItem {
  id: string;
  zoneId: string;
  zoneName: string;
  refCommand: string;
  amount: number;
  status: string;
  paymentMethod: string | null;
  paidAt: string | null;
  validUntil: string | null;
  createdAt: string;
}

export async function getSuperAdminPaymentHistory(filterZoneId?: string): Promise<GlobalPaymentHistoryItem[]> {
  const adminClient = await createAdminClient();
  let query = adminClient
    .from("zone_daily_payments")
    .select("id, zone_id, ref_command, amount, status, payment_method, paid_at, valid_until, created_at, zone:zones!zone_daily_payments_zone_id_fkey(name)")
    .order("created_at", { ascending: false })
    .limit(50);
  if (filterZoneId) query = query.eq("zone_id", filterZoneId);
  const { data } = await query;
  return (data || []).map((r: any) => ({
    id: r.id,
    zoneId: r.zone_id,
    zoneName: r.zone?.name || "—",
    refCommand: r.ref_command,
    amount: r.amount,
    status: r.status,
    paymentMethod: r.payment_method,
    paidAt: r.paid_at,
    validUntil: r.valid_until,
    createdAt: r.created_at,
  }));
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

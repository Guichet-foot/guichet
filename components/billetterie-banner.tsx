"use client";

import { useEffect, useState } from "react";
import { checkZonePayment, initiatePaytechPayment } from "@/lib/actions/payment-actions";
import type { PaymentStatus } from "@/lib/actions/payment-actions";
import { CreditCard, CheckCircle2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface BilletterieBannerProps {
  canPay: boolean;
}

function formatUntil(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) +
    " le " +
    d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
  );
}

export function BilletterieBanner({ canPay }: BilletterieBannerProps) {
  const [info, setInfo] = useState<PaymentStatus | null>(null);
  const [paying, setPaying] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    checkZonePayment().then(setInfo);
  }, []);

  async function handlePay() {
    setPaying(true);
    const result = await initiatePaytechPayment();
    if (result.error) {
      toast.error(result.error);
      setPaying(false);
      return;
    }
    if (result.redirectUrl) {
      window.location.href = result.redirectUrl;
    }
  }

  if (!info) return null;

  if (info.isPaid && info.validUntil) {
    return (
      <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 rounded-lg px-3 py-2 mb-4 text-sm">
        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
        <span>
          Billetterie ouverte jusqu&apos;à <strong>{formatUntil(info.validUntil)}</strong>
          {info.zoneName ? ` · ${info.zoneName}` : ""}
        </span>
      </div>
    );
  }

  if (info.isPaid) return null;

  if (dismissed) return null;

  if (!canPay) {
    return (
      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 mb-4 text-sm">
        <CreditCard className="h-4 w-4 text-amber-600 shrink-0" />
        <span className="flex-1">Zone non activée aujourd&apos;hui. Contactez votre administrateur.</span>
        <button onClick={() => setDismissed(true)} className="text-amber-500 hover:text-amber-700 shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-3 py-2 mb-4 text-sm">
      <CreditCard className="h-4 w-4 text-amber-600 shrink-0" />
      <span className="flex-1">
        Billetterie non activée ·{" "}
        <strong>
          {(info.amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} FCFA
        </strong>{" "}
        pour 24h
      </span>
      <button
        onClick={handlePay}
        disabled={paying}
        className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-1.5 rounded-md transition-colors shrink-0 disabled:opacity-60"
      >
        {paying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
        {paying ? "Redirection…" : "Activer maintenant"}
      </button>
      <Link href="/abonnements" className="text-xs text-amber-700 underline underline-offset-2 shrink-0">
        Historique
      </Link>
      <button onClick={() => setDismissed(true)} className="text-amber-400 hover:text-amber-600 shrink-0">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

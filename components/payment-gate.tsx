"use client";

import { useEffect, useState } from "react";
import { checkZonePayment, initiatePaytechPayment } from "@/lib/actions/payment-actions";
import type { PaymentStatus } from "@/lib/actions/payment-actions";
import { Button } from "@/components/ui/button";
import { Loader2, Lock, CreditCard, Clock } from "lucide-react";
import { toast } from "sonner";

interface PaymentGateProps {
  children: React.ReactNode;
}

function formatFCFA(n: number) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FCFA";
}

function formatValidUntil(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) +
    " le " + d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export function PaymentGate({ children }: PaymentGateProps) {
  const [status, setStatus] = useState<"loading" | "paid" | "unpaid">("loading");
  const [info, setInfo] = useState<PaymentStatus | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    checkZonePayment().then((result) => {
      setInfo(result);
      setStatus(result.isPaid ? "paid" : "unpaid");
    });
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

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  if (status === "paid") {
    return (
      <>
        {info?.validUntil && (
          <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-4">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            Zone activée jusqu&apos;à {formatValidUntil(info.validUntil)}
          </div>
        )}
        {children}
      </>
    );
  }

  const isAdmin = info?.userRole === "admin_zone";

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
          <Lock className="h-10 w-10 text-amber-600" />
        </div>

        <div>
          <h2 className="text-xl font-bold">Activation requise</h2>
          <p className="text-muted-foreground text-sm mt-2">
            {isAdmin
              ? "Cette fonctionnalité nécessite l'activation journalière de votre zone via un paiement."
              : "Votre zone n'est pas encore activée pour aujourd'hui. Contactez votre administrateur pour effectuer le paiement."}
          </p>
        </div>

        {isAdmin ? (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <p className="text-xs text-amber-700 uppercase tracking-widest font-semibold mb-1">
                Frais journaliers
              </p>
              <p className="text-4xl font-bold text-amber-700">
                {formatFCFA(info?.amount ?? 0)}
              </p>
              <p className="text-xs text-amber-600 mt-2">
                Valable 24h · Zone {info?.zoneName}
              </p>
              <p className="text-xs text-amber-500 mt-1">
                Débloque : Caisse, Scanner
              </p>
            </div>

            <Button
              onClick={handlePay}
              disabled={paying}
              className="w-full h-13 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-base py-4"
            >
              {paying ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Redirection vers Paytech…
                </>
              ) : (
                <>
                  <CreditCard className="h-5 w-5 mr-2" />
                  Payer avec Paytech
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground">
              Paiement sécurisé · Wave, Orange Money, carte bancaire
            </p>
          </>
        ) : (
          <div className="bg-muted/50 rounded-xl p-4 text-sm text-muted-foreground">
            Zone : <span className="font-semibold text-foreground">{info?.zoneName}</span>
            <br />
            L&apos;administrateur doit effectuer le paiement journalier.
          </div>
        )}
      </div>
    </div>
  );
}

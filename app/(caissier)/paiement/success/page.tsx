"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getPaymentByRef } from "@/lib/actions/payment-actions";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, Clock, ShoppingCart } from "lucide-react";
import { Suspense } from "react";

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const ref = searchParams.get("ref") || "";
  const [status, setStatus] = useState<"loading" | "confirmed" | "pending">("loading");
  const [validUntil, setValidUntil] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    async function checkStatus() {
      const result = await getPaymentByRef(ref);
      if (result?.status === "success") {
        setStatus("confirmed");
        setValidUntil(result.validUntil || null);
      } else if (attempts < 6) {
        // Réessayer toutes les 3 secondes (max 18s)
        setTimeout(() => setAttempts((a) => a + 1), 3000);
      } else {
        setStatus("pending");
      }
    }
    if (ref) checkStatus();
    else setStatus("pending");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, attempts]);

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-brand" />
        <p className="text-muted-foreground text-sm">Vérification du paiement…</p>
        <p className="text-xs text-muted-foreground">({attempts + 1}/6 tentatives)</p>
      </div>
    );
  }

  if (status === "confirmed") {
    const until = validUntil
      ? new Date(validUntil).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) +
        " le " + new Date(validUntil).toLocaleDateString("fr-FR", { day: "2-digit", month: "long" })
      : null;

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-green-700">Paiement confirmé !</h1>
            <p className="text-muted-foreground text-sm mt-2">
              Votre zone est maintenant activée.
            </p>
            {until && (
              <p className="text-sm font-medium mt-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <Clock className="h-4 w-4 inline mr-1 text-green-600" />
                Valable jusqu&apos;à {until}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Button
              onClick={() => router.push("/vente")}
              className="w-full h-12 bg-brand hover:bg-brand/90 font-semibold"
            >
              <ShoppingCart className="h-5 w-5 mr-2" />
              Ouvrir la caisse
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/scanner")}
              className="w-full h-12"
            >
              Aller au scanner
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Pending — IPN pas encore reçu
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
          <Clock className="h-10 w-10 text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Paiement en cours de traitement</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Si vous avez effectué le paiement, la confirmation peut prendre quelques minutes.
          </p>
        </div>
        <Button
          onClick={() => { setStatus("loading"); setAttempts(0); }}
          variant="outline"
          className="w-full"
        >
          <Loader2 className="h-4 w-4 mr-2" />
          Vérifier à nouveau
        </Button>
        <Button
          variant="ghost"
          onClick={() => router.push("/vente")}
          className="w-full text-muted-foreground"
        >
          Retour à la caisse
        </Button>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}

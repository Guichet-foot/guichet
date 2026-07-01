"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { XCircle, ArrowLeft, CreditCard } from "lucide-react";

export default function PaymentCancelPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto">
          <XCircle className="h-10 w-10 text-red-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Paiement annulé</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Le paiement n&apos;a pas été complété. La zone reste non activée.
          </p>
        </div>
        <div className="space-y-2">
          <Button
            onClick={() => router.push("/vente")}
            className="w-full h-12 bg-amber-600 hover:bg-amber-700"
          >
            <CreditCard className="h-5 w-5 mr-2" />
            Réessayer le paiement
          </Button>
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard")}
            className="w-full"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour au tableau de bord
          </Button>
        </div>
      </div>
    </div>
  );
}

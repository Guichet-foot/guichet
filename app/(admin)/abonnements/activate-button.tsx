"use client";

import { useState } from "react";
import { initiatePaytechPayment } from "@/lib/actions/payment-actions";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ActivateButtonProps {
  amount: number;
  zoneName: string;
}

export function ActivateButton({ amount, zoneName }: ActivateButtonProps) {
  const [paying, setPaying] = useState(false);

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

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-6 text-center">
        <p className="text-xs text-amber-700 font-bold uppercase tracking-widest mb-1">
          Frais journaliers · Zone {zoneName}
        </p>
        <p className="text-5xl font-bold text-amber-700 mt-2">
          {amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")}
        </p>
        <p className="text-lg text-amber-600 font-semibold">FCFA</p>
        <p className="text-xs text-amber-500 mt-2">Valable 24h à partir du paiement</p>
        <p className="text-xs text-amber-500">Débloque : Caisse · Scanner</p>
      </div>

      <Button
        onClick={handlePay}
        disabled={paying}
        className="w-full h-14 bg-amber-600 hover:bg-amber-700 text-white font-bold text-lg"
      >
        {paying ? (
          <><Loader2 className="h-5 w-5 animate-spin mr-2" />Redirection vers Paytech…</>
        ) : (
          <><CreditCard className="h-5 w-5 mr-2" />Activer la billetterie maintenant</>
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Paiement sécurisé · Wave, Orange Money, Free Money, carte bancaire
      </p>
    </div>
  );
}

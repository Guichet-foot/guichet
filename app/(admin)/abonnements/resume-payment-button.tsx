"use client";

import { useState } from "react";
import { initiatePaytechPayment } from "@/lib/actions/payment-actions";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function ResumePaymentButton() {
  const [loading, setLoading] = useState(false);

  async function handleResume() {
    setLoading(true);
    const result = await initiatePaytechPayment();
    if (result.error) {
      toast.error(result.error);
      setLoading(false);
      return;
    }
    if (result.redirectUrl) {
      window.location.href = result.redirectUrl;
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={handleResume}
      disabled={loading}
      className="h-7 text-xs border-amber-400 text-amber-700 hover:bg-amber-50 ml-2"
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin mr-1" />
      ) : (
        <CreditCard className="h-3 w-3 mr-1" />
      )}
      {loading ? "…" : "Terminer"}
    </Button>
  );
}

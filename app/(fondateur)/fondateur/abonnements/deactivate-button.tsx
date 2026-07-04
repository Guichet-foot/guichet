"use client";

import { useState } from "react";
import { deactivateZoneBilling } from "@/lib/actions/payment-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { PowerOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface DeactivateButtonProps {
  paymentId: string;
  zoneName: string;
}

export function DeactivateButton({ paymentId, zoneName }: DeactivateButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    const result = await deactivateZoneBilling(paymentId);
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setOpen(false);
    toast.success(`Billetterie de ${zoneName} désactivée`);
    router.refresh();
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
      >
        <PowerOff className="h-3.5 w-3.5" />
        <span className="ml-1 text-xs">Désactiver</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Désactiver la billetterie ?</DialogTitle>
            <DialogDescription className="pt-1">
              La billetterie de la zone <strong>{zoneName}</strong> sera fermée immédiatement.
              Les caissiers ne pourront plus vendre de billets jusqu&apos;à la prochaine activation.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <PowerOff className="h-4 w-4 mr-2" />
              )}
              Désactiver
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

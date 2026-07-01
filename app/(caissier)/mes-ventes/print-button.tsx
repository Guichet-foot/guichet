"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

interface PrintButtonProps {
  ticketId: string;
  batchId?: string | null;
}

export function PrintButton({ ticketId, batchId }: PrintButtonProps) {
  function handlePrint() {
    const url = batchId
      ? `/api/tickets/print-batch?batch=${batchId}`
      : `/api/tickets/${ticketId}/print`;
    window.open(url, "_blank");
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handlePrint}
      title="Réimprimer le(s) billet(s)"
    >
      <Printer className="h-4 w-4" />
    </Button>
  );
}

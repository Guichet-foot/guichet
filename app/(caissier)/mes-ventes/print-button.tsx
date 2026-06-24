"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function PrintButton({ ticketId }: { ticketId: string }) {
  function handlePrint() {
    window.open(`/api/tickets/${ticketId}/print`, "_blank");
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handlePrint}
      title="Réimprimer le billet"
    >
      <Printer className="h-4 w-4" />
    </Button>
  );
}

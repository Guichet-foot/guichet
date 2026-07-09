"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { printViaFrame } from "@/lib/print-frame";

const PRINT_FORMAT_KEY = "gf_print_format";

interface PrintButtonProps {
  ticketId: string;
  batchId?: string | null;
}

export function PrintButton({ ticketId, batchId }: PrintButtonProps) {
  function handlePrint() {
    const fmt = localStorage.getItem(PRINT_FORMAT_KEY) === "58" ? "58" : "80";
    const url = batchId
      ? `/api/tickets/print-batch?batch=${batchId}&fmt=${fmt}`
      : `/api/tickets/${ticketId}/print?fmt=${fmt}`;
    printViaFrame(url);
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

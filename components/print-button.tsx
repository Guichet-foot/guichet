"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function PrintButton({ label = "Télécharger PDF" }: { label?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => window.print()}
      className="print:hidden"
    >
      <Printer className="h-4 w-4 mr-2" />
      {label}
    </Button>
  );
}

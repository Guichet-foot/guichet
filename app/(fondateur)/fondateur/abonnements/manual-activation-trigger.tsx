"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Banknote } from "lucide-react";
import { ManualActivationModal } from "./manual-activation-modal";

interface ManualActivationTriggerProps {
  zones: { id: string; name: string }[];
  defaultAmount: number;
}

export function ManualActivationTrigger({ zones, defaultAmount }: ManualActivationTriggerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-amber-600 hover:bg-amber-700 text-white shrink-0"
      >
        <Banknote className="h-4 w-4 mr-2" />
        Activer manuellement
      </Button>
      <ManualActivationModal
        zones={zones}
        defaultAmount={defaultAmount}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

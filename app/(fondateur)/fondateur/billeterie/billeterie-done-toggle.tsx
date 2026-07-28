"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { toggleBilleterieIsDone } from "@/lib/actions/billeterie-actions";
import { toast } from "sonner";

interface Props {
  id: string;
  isDone: boolean;
}

export function BilleteriedonneToggle({ id, isDone: initialDone }: Props) {
  const [isDone, setIsDone] = useState(initialDone);
  const [loading, setLoading] = useState(false);

  async function handleToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    const next = !isDone;
    const result = await toggleBilleterieIsDone(id, next);
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      setIsDone(next);
      toast.success(next ? "Billetterie marquée comme terminée" : "Billetterie remise en cours");
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading}
      title={isDone ? "Marquer comme non terminée" : "Marquer comme terminée"}
      className={`flex items-center justify-center w-7 h-7 rounded-full transition-colors
        ${isDone
          ? "text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100"
          : "text-muted-foreground hover:text-green-600 bg-white hover:bg-green-50 border border-border hover:border-green-300"
        }`}
    >
      {loading
        ? <Loader2 className="h-4 w-4 animate-spin" />
        : isDone
          ? <CheckCircle2 className="h-4 w-4" />
          : <Circle className="h-4 w-4" />
      }
    </button>
  );
}

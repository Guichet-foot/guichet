"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  from?: string;
  to?: string;
  type?: string;
}

export function InterPdfButton({ from, to, type }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const res = await fetch("/api/reports/fondateur", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, type: "all" }),
      });
      if (!res.ok) {
        toast.error("Erreur lors de la génération du rapport");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rapport-financier${from ? `-${from}` : ""}${to ? `-au-${to}` : ""}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Rapport PDF téléchargé");
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" onClick={handleDownload} disabled={loading} className="shrink-0">
      {loading
        ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        : <FileDown className="h-4 w-4 mr-2" />}
      Télécharger PDF
    </Button>
  );
}

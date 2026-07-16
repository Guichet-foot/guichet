"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  date: string;
  zoneId: string | null;
  c3AccountId: string | null;
}

export function FicheRecettesButton({ date, zoneId, c3AccountId }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const res = await fetch("/api/reports/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, zoneId, c3AccountId }),
      });
      if (!res.ok) {
        toast.error("Erreur lors de la génération de la fiche");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fiche-recettes-${date}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Fiche de recettes téléchargée");
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" onClick={handleDownload} disabled={loading}>
      {loading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <FileText className="h-4 w-4 mr-2" />
      )}
      Fiche de Recettes
    </Button>
  );
}

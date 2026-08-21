"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  fromIso: string;
  toIso: string;
  zoneId?: string | null;
  c3AccountId?: string | null;
  matchId?: string | null;
}

export function ZonePdfButton({ fromIso, toIso, zoneId, c3AccountId, matchId }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const res = await fetch("/api/reports/zone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromIso, toIso, zoneId, c3AccountId, matchId }),
      });
      if (!res.ok) {
        toast.error("Erreur lors de la génération du rapport");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const date = fromIso.split("T")[0];
      a.download = `rapport-financier-${date}.pdf`;
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
    <Button variant="outline" onClick={handleDownload} disabled={loading}>
      {loading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <FileDown className="h-4 w-4 mr-2" />
      )}
      Télécharger PDF
    </Button>
  );
}

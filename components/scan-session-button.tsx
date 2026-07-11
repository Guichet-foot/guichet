"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScanLine, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

function getRemaining(openUntil: string | null): number {
  if (!openUntil) return 0;
  return Math.max(0, new Date(openUntil).getTime() - Date.now());
}

function formatRemaining(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${h}h${String(m).padStart(2, "0")}m${String(s).padStart(2, "0")}s`;
}

interface ScanSessionButtonProps {
  openUntil: string | null;
  openAction: () => Promise<{ error?: string; openUntil?: string; success?: boolean }>;
  closeAction: () => Promise<{ error?: string; success?: boolean }>;
}

export function ScanSessionButton({
  openUntil: initialOpenUntil,
  openAction,
  closeAction,
}: ScanSessionButtonProps) {
  const router = useRouter();
  const [openUntil, setOpenUntil] = useState(initialOpenUntil);
  const [remaining, setRemaining] = useState(() => getRemaining(initialOpenUntil));
  const [loading, setLoading] = useState(false);

  const isOpen = remaining > 0;

  useEffect(() => {
    if (!openUntil) return;
    const interval = setInterval(() => {
      const r = getRemaining(openUntil);
      setRemaining(r);
      if (r === 0) setOpenUntil(null);
    }, 1000);
    return () => clearInterval(interval);
  }, [openUntil]);

  async function handleOpen() {
    setLoading(true);
    const result = await openAction();
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    setOpenUntil(result.openUntil!);
    setRemaining(getRemaining(result.openUntil!));
    toast.success("Billeterie ouverte — matchs du jour passés En cours");
    router.refresh();
  }

  async function handleClose() {
    setLoading(true);
    const result = await closeAction();
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    setOpenUntil(null);
    setRemaining(0);
    toast.success("Billeterie fermée");
  }

  if (isOpen) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClose}
        disabled={loading}
        className="border-danger text-danger hover:bg-danger/10"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <X className="h-4 w-4 mr-1.5" />
            Fermer · {formatRemaining(remaining)}
          </>
        )}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleOpen}
      disabled={loading}
      className="border-green-600 text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <ScanLine className="h-4 w-4 mr-1.5" />
          Ouvrir la billeterie
        </>
      )}
    </Button>
  );
}

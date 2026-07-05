"use client";

import { useState, useEffect, useRef } from "react";
import { scanUnsoldTicket } from "@/lib/actions/invendus-actions";
import { Card, CardContent } from "@/components/ui/card";
import { PackageX, CheckCircle2, AlertTriangle, XCircle, ScanLine } from "lucide-react";

interface Props {
  matchId: string;
  initialAnnuleCount: number;
}

type ScanState = "idle" | "ok" | "already_annule" | "already_scanned" | "not_found";

export function InvendusScanner({ matchId, initialAnnuleCount }: Props) {
  const [annuleCount, setAnnuleCount] = useState(initialAnnuleCount);
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [message, setMessage] = useState("");
  const [scanning, setScanning] = useState(true);
  const scannerRef = useRef<HTMLDivElement>(null);
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const html5QrCodeRef = useRef<any>(null);
  void matchId;

  useEffect(() => {
    let scanner: { clear: () => Promise<void> } | null = null;

    async function initScanner() {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (!scannerRef.current) return;
      const html5QrCode = new Html5Qrcode("invendus-qr-reader");
      html5QrCodeRef.current = html5QrCode;
      scanner = html5QrCode as unknown as { clear: () => Promise<void> };

      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decoded: string) => {
          if (!scanning) return;
          setScanning(false);
          try { await html5QrCode.pause(); } catch { }

          // Extract qr_token from ticket URL or raw UUID
          let token = decoded.trim();
          try {
            const url = new URL(decoded);
            const parts = url.pathname.split("/");
            // ticket URL format: /billet/{token} or similar
            const last = parts[parts.length - 1];
            if (last) token = last;
          } catch { /* raw token */ }

          const result = await scanUnsoldTicket(token);
          setScanState(result.status);
          setMessage(result.message);

          if (result.status === "ok") {
            setAnnuleCount((n) => n + 1);
            if ("vibrate" in navigator) navigator.vibrate([100]);
          } else {
            if ("vibrate" in navigator) navigator.vibrate([100, 50, 100]);
          }

          setTimeout(async () => {
            try { await html5QrCode.resume(); } catch { }
            setScanState("idle");
            setMessage("");
            setScanning(true);
          }, 2500);
        },
        () => {}
      );
    }

    initScanner();
    return () => { if (scanner) scanner.clear().catch(() => {}); };
  }, []);

  const STATE_META: Record<Exclude<ScanState, "idle">, { bg: string; Icon: typeof CheckCircle2; title: string }> = {
    ok: { bg: "bg-green-700/95", Icon: CheckCircle2, title: "INVENDU ENREGISTRÉ" },
    already_annule: { bg: "bg-blue-600/95", Icon: AlertTriangle, title: "DÉJÀ ANNULÉ" },
    already_scanned: { bg: "bg-orange-600/95", Icon: AlertTriangle, title: "DÉJÀ UTILISÉ" },
    not_found: { bg: "bg-red-700/95", Icon: XCircle, title: "BILLET INVALIDE" },
  };
  const meta = scanState !== "idle" ? STATE_META[scanState] : null;

  return (
    <div className="space-y-4">
      {/* Counter */}
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Invendus annulés</p>
              <p className="text-2xl font-bold text-red-700">{annuleCount} billet(s)</p>
            </div>
            <PackageX className="h-8 w-8 text-red-400" />
          </div>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground text-center">
        Scannez chaque billet invendu pour l&apos;annuler du système.
      </p>

      {/* Camera */}
      <div className="relative">
        <div id="invendus-qr-reader" ref={scannerRef} className="rounded-xl overflow-hidden" />
      </div>

      {/* Result overlay */}
      {meta && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-8 ${meta.bg}`}>
          <div className="text-center text-white space-y-3">
            <meta.Icon className="h-20 w-20 mx-auto" />
            <p className="text-2xl font-black">{meta.title}</p>
            <p className="text-base opacity-90">{message}</p>
            {scanState === "ok" && (
              <p className="text-lg font-bold opacity-80">{annuleCount} invendu(s) total</p>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
        <ScanLine className="h-4 w-4 shrink-0" />
        <span>Scannez uniquement les billets physiques <strong>non utilisés</strong> que vous récupérez après le match.</span>
      </div>
    </div>
  );
}

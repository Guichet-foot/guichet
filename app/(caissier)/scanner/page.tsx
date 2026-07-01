"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { validateTicket } from "@/lib/actions/ticket-actions";
import { Card, CardContent } from "@/components/ui/card";
import { ScanLine, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { ScanResult } from "@/lib/types";
import { PaymentGate } from "@/components/payment-gate";

function ScannerContent() {
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(true);
  const [stats, setStats] = useState({ validated: 0, total: 0 });
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrCodeRef = useRef<unknown>(null);

  const resumeScanning = useCallback(() => {
    setScanResult(null);
    setScanning(true);
  }, []);

  useEffect(() => {
    let scanner: { clear: () => Promise<void> } | null = null;

    async function initScanner() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");

        if (!scannerRef.current) return;

        const html5QrCode = new Html5Qrcode("qr-reader");
        html5QrCodeRef.current = html5QrCode;
        scanner = html5QrCode as unknown as { clear: () => Promise<void> };

        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          async (decodedText: string) => {
            if (!scanning) return;
            setScanning(false);

            try {
              await html5QrCode.pause();
            } catch {
              // ignore
            }

            try {
              const result = await validateTicket(decodedText);
              setScanResult(result);

              if (result.status === "valid") {
                setStats((prev) => ({
                  ...prev,
                  validated: prev.validated + 1,
                }));
                vibrate([100]);
              } else if (result.status === "already_scanned") {
                vibrate([100, 50, 100]);
              } else {
                vibrate([100, 50, 100, 50, 100]);
              }
            } catch {
              setScanResult({
                status: "invalid",
                message: "Erreur réseau. Vérifiez votre connexion.",
              });
              vibrate([100, 50, 100, 50, 100]);
            }

            setTimeout(async () => {
              try {
                await html5QrCode.resume();
              } catch {
                // ignore
              }
              resumeScanning();
            }, 2500);
          },
          () => {}
        );
      } catch (err) {
        setCameraError(
          "Impossible d'accéder à la caméra. Autorisez l'accès dans les paramètres."
        );
      }
    }

    initScanner();

    return () => {
      if (scanner) {
        scanner.clear().catch(() => {});
      }
    };
  }, []);

  function vibrate(pattern: number[]) {
    if ("vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  }

  return (
    <div className="space-y-4 max-w-md mx-auto">
      <Card className="bg-brand/5 border-brand/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Entrées validées</p>
              <p className="text-lg font-bold">
                {stats.validated} entrée{stats.validated > 1 ? "s" : ""}
              </p>
            </div>
            <ScanLine className="h-8 w-8 text-brand" />
          </div>
        </CardContent>
      </Card>

      {cameraError ? (
        <Card className="border-danger/30">
          <CardContent className="py-8 text-center">
            <XCircle className="h-12 w-12 text-danger mx-auto mb-4" />
            <p className="text-danger font-medium">{cameraError}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="relative">
          <div
            id="qr-reader"
            ref={scannerRef}
            className="rounded-xl overflow-hidden"
          />
        </div>
      )}

      {scanResult && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${
            scanResult.status === "valid"
              ? "bg-green-600/95"
              : scanResult.status === "already_scanned"
                ? "bg-orange-500/95"
                : "bg-red-600/95"
          }`}
        >
          <div className="text-center text-white space-y-4">
            {scanResult.status === "valid" && (
              <CheckCircle className="h-24 w-24 mx-auto" />
            )}
            {scanResult.status === "already_scanned" && (
              <AlertTriangle className="h-24 w-24 mx-auto" />
            )}
            {scanResult.status === "invalid" && (
              <XCircle className="h-24 w-24 mx-auto" />
            )}

            <p className="text-2xl font-bold">
              {scanResult.status === "valid" && "ENTRÉE VALIDÉE"}
              {scanResult.status === "already_scanned" && "DÉJÀ UTILISÉ"}
              {scanResult.status === "invalid" && "BILLET INVALIDE"}
            </p>

            {scanResult.categoryName && (
              <p className="text-xl">{scanResult.categoryName}</p>
            )}

            {scanResult.status === "already_scanned" && scanResult.scannedAt && (
              <p className="text-lg">à {formatDateTime(scanResult.scannedAt)}</p>
            )}

            {scanResult.status === "invalid" && (
              <p className="text-lg">{scanResult.message}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ScannerPage() {
  return (
    <PaymentGate>
      <ScannerContent />
    </PaymentGate>
  );
}

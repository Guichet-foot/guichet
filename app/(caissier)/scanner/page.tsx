"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { validateTicket } from "@/lib/actions/ticket-actions";
import { getCardByQRToken } from "@/lib/actions/carte-actions";
import { Card, CardContent } from "@/components/ui/card";
import { ScanLine, CheckCircle, AlertTriangle, XCircle, User, CreditCard } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { ScanResult, AccessCard } from "@/lib/types";
import { PaymentGate } from "@/components/payment-gate";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://guichet-pi.vercel.app";

function extractCardToken(text: string): string | null {
  try {
    const url = new URL(text);
    const parts = url.pathname.split("/");
    const idx = parts.indexOf("carte");
    if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
  } catch {
    // not a URL
  }
  return null;
}

function ScannerContent() {
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [cardResult, setCardResult] = useState<AccessCard | null>(null);
  const [scanning, setScanning] = useState(true);
  const [stats, setStats] = useState({ validated: 0, total: 0 });
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrCodeRef = useRef<unknown>(null);

  const resumeScanning = useCallback(() => {
    setScanResult(null);
    setCardResult(null);
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
          { fps: 10, qrbox: { width: 250, height: 250 } },
          async (decodedText: string) => {
            if (!scanning) return;
            setScanning(false);

            try { await html5QrCode.pause(); } catch { }

            // Detect if it's a card QR (URL containing /carte/)
            const cardToken = extractCardToken(decodedText);

            if (cardToken) {
              // Member card scan
              try {
                const card = await getCardByQRToken(cardToken);
                if (card) {
                  setCardResult(card);
                  vibrate([100, 50, 100]);
                } else {
                  setScanResult({ status: "invalid", message: "Carte inconnue dans le système." });
                  vibrate([100, 50, 100, 50, 100]);
                }
              } catch {
                setScanResult({ status: "invalid", message: "Erreur réseau. Réessayez." });
                vibrate([100, 50, 100, 50, 100]);
              }
            } else {
              // Regular ticket scan
              try {
                const result = await validateTicket(decodedText);
                setScanResult(result);
                if (result.status === "valid") {
                  setStats((prev) => ({ ...prev, validated: prev.validated + 1 }));
                  vibrate([100]);
                } else if (result.status === "already_scanned") {
                  vibrate([100, 50, 100]);
                } else {
                  vibrate([100, 50, 100, 50, 100]);
                }
              } catch {
                setScanResult({ status: "invalid", message: "Erreur réseau. Vérifiez votre connexion." });
                vibrate([100, 50, 100, 50, 100]);
              }
            }

            setTimeout(async () => {
              try { await html5QrCode.resume(); } catch { }
              resumeScanning();
            }, cardToken ? 4000 : 2500);
          },
          () => {}
        );
      } catch {
        setCameraError("Impossible d'accéder à la caméra. Autorisez l'accès dans les paramètres.");
      }
    }

    initScanner();
    return () => { if (scanner) scanner.clear().catch(() => {}); };
  }, []);

  function vibrate(pattern: number[]) {
    if ("vibrate" in navigator) navigator.vibrate(pattern);
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
          <div id="qr-reader" ref={scannerRef} className="rounded-xl overflow-hidden" />
        </div>
      )}

      {/* Ticket scan overlay */}
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
            {scanResult.status === "valid" && <CheckCircle className="h-24 w-24 mx-auto" />}
            {scanResult.status === "already_scanned" && <AlertTriangle className="h-24 w-24 mx-auto" />}
            {scanResult.status === "invalid" && <XCircle className="h-24 w-24 mx-auto" />}
            <p className="text-2xl font-bold">
              {scanResult.status === "valid" && "ENTRÉE VALIDÉE"}
              {scanResult.status === "already_scanned" && "DÉJÀ UTILISÉ"}
              {scanResult.status === "invalid" && "BILLET INVALIDE"}
            </p>
            {scanResult.categoryName && <p className="text-xl">{scanResult.categoryName}</p>}
            {scanResult.status === "already_scanned" && scanResult.scannedAt && (
              <p className="text-lg">à {formatDateTime(scanResult.scannedAt)}</p>
            )}
            {scanResult.status === "invalid" && (
              <p className="text-lg">{scanResult.message}</p>
            )}
          </div>
        </div>
      )}

      {/* Member card overlay */}
      {cardResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-green-900/95">
          <div className="w-full max-w-xs">
            {/* Header */}
            <div className="text-center mb-4">
              <CreditCard className="h-8 w-8 text-green-300 mx-auto mb-1" />
              <p className="text-green-300 font-bold text-sm uppercase tracking-wider">
                Carte membre vérifiée
              </p>
            </div>

            {/* Card preview */}
            <div className="bg-white rounded-2xl border-4 border-green-400 overflow-hidden shadow-2xl">
              {/* Header */}
              <div className="bg-green-50 border-b-2 border-green-700 p-3 flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-green-800 uppercase">Carte d&apos;accès</p>
                  <p className="text-xs text-green-700 font-semibold">ODCAV Navétane</p>
                </div>
                <div className="w-14 h-14 rounded-full border-2 border-green-700 overflow-hidden bg-green-100">
                  {cardResult.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cardResult.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="h-7 w-7 text-green-700" />
                    </div>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="divide-y divide-gray-100">
                {[
                  { label: "NOM COMPLET", value: cardResult.full_name },
                  { label: "TÉLÉPHONE", value: cardResult.phone },
                  { label: "ZONE", value: cardResult.zone_name },
                  { label: "POSTE", value: cardResult.poste },
                  ...(cardResult.asc_name ? [{ label: "ASC", value: cardResult.asc_name }] : []),
                ].map(({ label, value }) => (
                  <div key={label} className="px-3 py-2">
                    <p className="text-[9px] font-bold text-green-800 uppercase">{label}</p>
                    <p className="text-sm font-bold text-gray-900">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-center text-green-400 text-xs mt-3">
              Fermeture automatique dans quelques secondes…
            </p>
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

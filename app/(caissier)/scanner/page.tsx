"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { validateTicket } from "@/lib/actions/ticket-actions";
import { validateBilleterieTicket } from "@/lib/actions/billeterie-actions";
import { getCardByQRToken } from "@/lib/actions/carte-actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ScanLine,
  CheckCircle,
  AlertTriangle,
  XCircle,
  User,
} from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { ScanResult, AccessCard } from "@/lib/types";

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
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const html5QrCodeRef = useRef<any>(null);

  const resumeScanning = useCallback(() => {
    setScanResult(null);
    setCardResult(null);
    setScanning(true);
  }, []);

  // Fermer l'overlay carte et relancer le scanner
  async function closeCardOverlay() {
    try {
      if (html5QrCodeRef.current) await html5QrCodeRef.current.resume();
    } catch { }
    resumeScanning();
  }

  useEffect(() => {
    let scanner: { clear: () => Promise<void> } | null = null;

    async function initScanner() {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (!scannerRef.current) return;

        // Restrict to QR_CODE only — avoids decoding barcodes/DataMatrix on every frame
        const html5QrCode = new Html5Qrcode("qr-reader", {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
        html5QrCodeRef.current = html5QrCode;
        scanner = html5QrCode as unknown as { clear: () => Promise<void> };

        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 15, qrbox: { width: 220, height: 220 } },
          async (decodedText: string) => {
            if (!scanning) return;
            setScanning(false);

            try { await html5QrCode.pause(); } catch { }

            const cardToken = extractCardToken(decodedText);

            if (cardToken) {
              // ── Scan carte membre ──
              try {
                const card = await getCardByQRToken(cardToken);
                if (card) {
                  setCardResult(card);
                  vibrate([100, 50, 100]);
                  // Pas de fermeture automatique — le portier clique sur "Validé"
                } else {
                  setScanResult({ status: "invalid", message: "Carte inconnue dans le système." });
                  vibrate([100, 50, 100, 50, 100]);
                  setTimeout(async () => {
                    try { await html5QrCode.resume(); } catch { }
                    resumeScanning();
                  }, 2500);
                }
              } catch {
                setScanResult({ status: "invalid", message: "Erreur réseau. Réessayez." });
                vibrate([100, 50, 100, 50, 100]);
                setTimeout(async () => {
                  try { await html5QrCode.resume(); } catch { }
                  resumeScanning();
                }, 2500);
              }
            } else {
              // ── Scan billet (ordinaire ou billetterie) ──
              let dismissDelay = 2500;
              try {
                const result = decodedText.startsWith("BIL-")
                  ? await validateBilleterieTicket(decodedText)
                  : await validateTicket(decodedText);
                setScanResult(result);
                if (result.status === "valid") {
                  setStats((prev) => ({ ...prev, validated: prev.validated + 1 }));
                  vibrate([100]);
                  dismissDelay = 1200; // entrée validée — message court, retour rapide
                } else if (result.status === "already_scanned") {
                  vibrate([100, 50, 100]);
                  dismissDelay = 1800;
                } else {
                  vibrate([100, 50, 100, 50, 100]);
                  dismissDelay = 2500; // message d'erreur à lire
                }
              } catch {
                setScanResult({ status: "invalid", message: "Erreur réseau. Vérifiez votre connexion." });
                vibrate([100, 50, 100, 50, 100]);
              }
              setTimeout(async () => {
                try { await html5QrCode.resume(); } catch { }
                resumeScanning();
              }, dismissDelay);
            }
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

      {/* ── Overlay billet ── */}
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

      {/* ── Overlay carte membre ── */}
      {cardResult && (
        <div className="fixed inset-0 z-50 flex flex-col bg-green-950">

          {/* Bandeau titre */}
          <div className="bg-green-800 px-4 py-3 text-center shrink-0">
            <p className="text-green-200 text-xs font-bold uppercase tracking-widest">
              ✓ Carte membre vérifiée
            </p>
          </div>

          {/* Photo — très grande, prend la majorité de l'espace */}
          <div className="flex-1 flex items-center justify-center p-6">
            <div
              className="rounded-full overflow-hidden bg-green-800 border-4 border-green-400 shadow-2xl"
              style={{ width: "min(72vw, 72vh)", height: "min(72vw, 72vh)" }}
            >
              {cardResult.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cardResult.photo_url}
                  alt={cardResult.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-1/2 h-1/2 text-green-300" />
                </div>
              )}
            </div>
          </div>

          {/* Infos + bouton Validé */}
          <div className="bg-green-900 px-5 pt-4 pb-8 shrink-0 space-y-3">
            {/* Nom */}
            <div className="text-center">
              <p className="text-white text-2xl font-black leading-tight">
                {cardResult.full_name}
              </p>
              <p className="text-green-300 text-base font-semibold mt-1">
                {cardResult.poste}
              </p>
              <p className="text-green-400 text-sm">
                {cardResult.zone_name}
                {cardResult.asc_name ? ` · ${cardResult.asc_name}` : ""}
              </p>
            </div>

            {/* Bouton Validé */}
            <Button
              onClick={closeCardOverlay}
              className="w-full h-14 text-xl font-black rounded-2xl bg-green-500 hover:bg-green-400 active:bg-green-600 text-white shadow-lg border-0"
            >
              <CheckCircle className="h-6 w-6 mr-2" />
              VALIDÉ
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ScannerPage() {
  return <ScannerContent />;
}

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

const THRESHOLD = 72;   // px nécessaires pour déclencher le refresh
const MAX_PULL  = 100;  // px max de l'indicateur visible

export function PullToRefresh() {
  const router = useRouter();
  const [pullY, setPullY]       = useState(0);  // 0..MAX_PULL
  const [refreshing, setRefreshing] = useState(false);

  const startYRef = useRef<number | null>(null);
  const pullingRef = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    // Activer seulement si on est tout en haut
    if (window.scrollY === 0) {
      startYRef.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (startYRef.current === null || refreshing) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta <= 0) {
      startYRef.current = null;
      return;
    }
    // Si l'utilisateur tire vers le bas depuis le haut
    pullingRef.current = true;
    const clamped = Math.min(delta * 0.5, MAX_PULL);
    setPullY(clamped);
    // Empêcher le scroll natif pendant le pull
    if (clamped > 4) e.preventDefault();
  }, [refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!pullingRef.current) return;
    pullingRef.current = false;
    startYRef.current = null;

    if (pullY >= THRESHOLD) {
      setRefreshing(true);
      setPullY(THRESHOLD); // garder l'indicateur visible pendant le refresh
      router.refresh();
      // Attendre un court délai pour laisser next.js recharger les données
      await new Promise((r) => setTimeout(r, 900));
      setRefreshing(false);
    }
    setPullY(0);
  }, [pullY, router]);

  useEffect(() => {
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove",  handleTouchMove,  { passive: false });
    document.addEventListener("touchend",   handleTouchEnd,   { passive: true });
    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove",  handleTouchMove);
      document.removeEventListener("touchend",   handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  if (pullY === 0 && !refreshing) return null;

  const progress = Math.min(pullY / THRESHOLD, 1);
  const rotation = refreshing ? undefined : progress * 270;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
      style={{ transform: `translateY(${pullY - 48}px)`, transition: pullY === 0 ? "transform 0.2s" : "none" }}
    >
      <div className="mt-2 w-10 h-10 rounded-full bg-brand shadow-lg flex items-center justify-center">
        <RefreshCw
          className={`h-5 w-5 text-white ${refreshing ? "animate-spin" : ""}`}
          style={rotation !== undefined ? { transform: `rotate(${rotation}deg)` } : undefined}
        />
      </div>
    </div>
  );
}

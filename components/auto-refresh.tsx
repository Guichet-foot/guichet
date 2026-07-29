"use client";

import { useEffect, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";

export function AutoRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Prevent overlapping refreshes if server is slow
  const inFlight = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      if (inFlight.current) return;
      inFlight.current = true;
      startTransition(() => {
        router.refresh();
      });
      // Clear the flag after the interval so next tick can fire
      setTimeout(() => { inFlight.current = false; }, intervalMs * 0.9);
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs, startTransition]);

  return null;
}

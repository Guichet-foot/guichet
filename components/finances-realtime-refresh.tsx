"use client";

import { useEffect, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Subscribes to billeterie_scans and tickets changes via Supabase Realtime.
// Calls router.refresh() immediately when a scan is detected.
export function FinancesRealtimeRefresh() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const inFlight = useRef(false);

  useEffect(() => {
    const supabase = createClient();

    function triggerRefresh() {
      if (inFlight.current) return;
      inFlight.current = true;
      startTransition(() => router.refresh());
      setTimeout(() => { inFlight.current = false; }, 1500);
    }

    const channel = supabase
      .channel("finances-realtime-scans")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "billeterie_scans" }, triggerRefresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tickets" }, triggerRefresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tickets" }, triggerRefresh)
      .subscribe();

    // Fallback polling every 5s in case Realtime is unavailable
    const poll = setInterval(triggerRefresh, 5_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [router, startTransition]);

  return null;
}

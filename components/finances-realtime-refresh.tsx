"use client";

import { useEffect, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Subscribes to billeterie_scans and tickets changes via Supabase Realtime.
// Calls router.refresh() (debounced) when a scan is detected.
//
// The Finances page runs several heavy paginated queries per render. With many
// zones open at once on a small Supabase instance, refreshing too aggressively
// (previously: ~every 1.5s per tab during active scanning, plus a 5s fallback
// poll) saturated the Postgres connection pool and took the whole site down
// with 504s. Keep refreshes debounced and infrequent — see memory/platform-stability-refresh-rates.md.
const DEBOUNCE_MS = 8_000;
const FALLBACK_POLL_MS = 30_000;

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
      setTimeout(() => { inFlight.current = false; }, DEBOUNCE_MS);
    }

    const channel = supabase
      .channel("finances-realtime-scans")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "billeterie_scans" }, triggerRefresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tickets" }, triggerRefresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tickets" }, triggerRefresh)
      .subscribe();

    // Fallback polling in case Realtime is unavailable
    const poll = setInterval(triggerRefresh, FALLBACK_POLL_MS);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [router, startTransition]);

  return null;
}

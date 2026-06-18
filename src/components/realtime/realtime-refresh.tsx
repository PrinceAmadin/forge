"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { RealtimePostgresChangesFilter } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type PgEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

// Pure side-effect: subscribe to Postgres changes on `table` (optionally scoped
// by `event` and a PostgREST-style `filter`, e.g. "status=eq.confirmed") and
// call router.refresh() so the server components re-render with fresh data.
// Refreshes are debounced so a burst of changes settles into one refetch. §realtime
export function RealtimeRefresh({
  table,
  event = "*",
  filter,
  debounceMs = 1000,
}: {
  table: string;
  event?: PgEvent;
  filter?: string;
  debounceMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const config = {
      event,
      schema: "public",
      table,
      ...(filter ? { filter } : {}),
    } as RealtimePostgresChangesFilter<PgEvent>;

    const channel = supabase
      .channel(`realtime:${table}:${event}:${filter ?? "all"}`)
      .on("postgres_changes", config, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => router.refresh(), debounceMs);
      })
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [table, event, filter, debounceMs, router]);

  return null;
}

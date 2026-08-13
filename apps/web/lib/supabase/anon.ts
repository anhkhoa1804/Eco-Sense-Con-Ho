import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { AppSupabase } from "@/lib/repositories/base";
import { isLikelySupabasePublicKey, isValidHttpUrl } from "@/lib/supabase/env";

/**
 * Anon-key client for server-side reads that don't need an authenticated
 * user session — the public dashboard, station pages, etc. Unlike
 * service.ts's client, this one is genuinely bound by RLS: it can only see
 * what migration 018's anon SELECT policies allow (stations,
 * environmental_readings, environmental_events, station_health_logs,
 * crop_thresholds). A bug in a public repository query can no longer leak
 * devices, audit logs, or any other sensitive table, because the anon role
 * structurally can't read them regardless of what the query asks for.
 */
export function createAnonClient(): AppSupabase | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!isValidHttpUrl(url) || !isLikelySupabasePublicKey(key)) {
    console.warn("[Horizon] Public Supabase credentials missing. Running in demo mode.");
    return null;
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

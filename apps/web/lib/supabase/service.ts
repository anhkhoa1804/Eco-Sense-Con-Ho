import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { AppSupabase } from "@/lib/repositories/base";
import { isLikelySupabaseServiceKey, isValidHttpUrl } from "@/lib/supabase/env";

export function createServiceClient(): AppSupabase | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!isValidHttpUrl(url) || !isLikelySupabaseServiceKey(key)) {
    console.warn(
      "[Horizon] Service role credentials missing. Running in demo mode."
    );

    return null;
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

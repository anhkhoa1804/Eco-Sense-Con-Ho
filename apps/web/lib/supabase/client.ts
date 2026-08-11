import { createBrowserClient } from "@supabase/ssr";
import { isLikelySupabasePublicKey, isValidHttpUrl } from "@/lib/supabase/env";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!isValidHttpUrl(url) || !isLikelySupabasePublicKey(key)) {
    console.warn("[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Returning null.");
    return null;
  }

  return createBrowserClient(url, key);
}

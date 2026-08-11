import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isLikelySupabasePublicKey, isValidHttpUrl } from "@/lib/supabase/env";

export async function createClient() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!isValidHttpUrl(url) || !isLikelySupabasePublicKey(key)) {
    console.warn("[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Returning null.");
    return null;
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },

      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options?: Record<string, unknown>;
        }[]
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // middleware handles refresh
        }
      },
    },
  });
}

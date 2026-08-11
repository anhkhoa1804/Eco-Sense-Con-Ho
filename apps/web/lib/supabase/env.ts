export function isValidHttpUrl(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isLikelySupabasePublicKey(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  return value.startsWith("sb_publishable_") || value.startsWith("eyJ");
}

export function isLikelySupabaseServiceKey(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  return value.startsWith("sb_secret_") || value.startsWith("eyJ");
}

export function hasSupabasePublicConfig(): boolean {
  return (
    isValidHttpUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    isLikelySupabasePublicKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

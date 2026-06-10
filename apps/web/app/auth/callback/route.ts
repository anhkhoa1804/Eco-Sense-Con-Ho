import { NextResponse } from "next/server";
import { ensureUserProfile } from "@/lib/auth/bootstrap";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect") ?? "/admin";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      await ensureUserProfile(supabase, data.user);
      return NextResponse.redirect(`${origin}${redirect.startsWith("/") ? redirect : "/admin"}`);
    }
  }

  return NextResponse.redirect(`${origin}/admin/login?error=auth_callback_failed`);
}

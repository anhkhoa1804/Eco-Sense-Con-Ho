import { SignOutButton } from "@/components/auth/sign-out-button";
import { LoginForm } from "@/components/auth/login-form";
import { SiteHeader } from "@/components/layout/site-header";
import { getI18n } from "@/lib/i18n/server";
import type { Dictionary } from "@/lib/i18n/vi";

function errorMessage(error: string | undefined, dict: Dictionary): string | null {
  switch (error) {
    case "unauthorized":
      return dict.errors.loginNotAllowed;
    case "bad-password":
      return dict.errors.loginBadPassword;
    case "rate-limited":
      return dict.errors.loginRateLimited;
    case "not-configured":
      return dict.errors.loginNotConfigured;
    default:
      return null;
  }
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string; email?: string }>;
}) {
  const params = await searchParams;
  const redirectTo = params.redirect ?? "/admin";
  const { dict } = await getI18n();
  const message = errorMessage(params.error, dict);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader register="admin" />
      {/* var(--header-h), not a hardcoded pixel figure: the header's resting
          height is fluid (--header-h scales 6.25rem/7rem/7.5rem across
          breakpoints and shrinks further once scrolled), so a fixed "88px"
          left over from the pre-rebrand header under- or over-shot the real
          offset depending on viewport. */}
      <main className="flex min-h-[calc(100dvh-var(--header-h))] flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md space-y-4">
          {message ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-critical" role="alert">
                {message}
              </p>
              {params.error === "unauthorized" ? <SignOutButton /> : null}
            </div>
          ) : null}
          <LoginForm redirectTo={redirectTo} defaultEmail={params.email ?? ""} />
        </div>
      </main>
    </div>
  );
}

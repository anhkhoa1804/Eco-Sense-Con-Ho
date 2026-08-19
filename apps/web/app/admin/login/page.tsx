import { SignOutButton } from "@/components/auth/sign-out-button";
import { LoginForm } from "@/components/auth/login-form";
import { SiteHeader } from "@/components/layout/site-header";

function errorMessage(error?: string): string | null {
  switch (error) {
    case "unauthorized":
      return "Email này chưa nằm trong danh sách được phép quản trị.";
    case "bad-password":
      return "Mật khẩu quản trị chưa đúng.";
    case "rate-limited":
      return "Đã thử sai quá nhiều lần. Vui lòng chờ ít phút rồi thử lại.";
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
  const message = errorMessage(params.error);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader register="admin" />
      <main className="flex min-h-[calc(100dvh-88px)] flex-col items-center justify-center px-4 py-10">
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

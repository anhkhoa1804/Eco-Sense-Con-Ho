import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { LoginForm } from "@/components/auth/login-form";

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
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-8 text-center">
        <p className="text-xs uppercase tracking-[0.18em] text-accent">Horizon</p>
        <p className="text-lg font-semibold">Cồn Hô · Quản trị</p>
      </Link>
      {message ? (
        <div className="mb-4 flex max-w-md flex-col items-center gap-3 text-center">
          <p className="text-sm text-critical" role="alert">
            {message}
          </p>
          {params.error === "unauthorized" ? <SignOutButton /> : null}
        </div>
      ) : null}
      <LoginForm redirectTo={redirectTo} defaultEmail={params.email ?? ""} />
      <p className="mt-4 max-w-md text-center text-sm text-muted">
        Email được phép lấy từ ADMIN_ALLOWED_EMAILS. Mật khẩu lấy từ ADMIN_PASSWORD trong file .env.local.
      </p>
    </main>
  );
}

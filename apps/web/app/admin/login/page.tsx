import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { Skeleton } from "@/components/ui/skeleton";

function LoginFallback() {
  return <Skeleton className="mx-auto h-80 w-full max-w-md" />;
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  const params = await searchParams;
  const redirectTo = params.redirect ?? "/admin";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-8 text-center">
        <p className="text-xs uppercase tracking-[0.18em] text-accent">Eco-Sense</p>
        <p className="text-lg font-semibold">Cồn Hô · Quản trị</p>
      </Link>
      {params.error === "unauthorized" ? (
        <p className="mb-4 text-sm text-critical" role="alert">
          Cần quyền quản trị. Nếu bạn cần quyền truy cập, hãy liên hệ người vận hành dự án.
        </p>
      ) : null}
      <Suspense fallback={<LoginFallback />}>
        <LoginForm redirectTo={redirectTo} />
      </Suspense>
    </div>
  );
}

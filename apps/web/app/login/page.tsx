import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { Skeleton } from "@/components/ui/skeleton";

function LoginFallback() {
  return <Skeleton className="mx-auto h-80 w-full max-w-md" />;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;
  const redirectTo = params.redirect ?? "/dashboard";

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <Suspense fallback={<LoginFallback />}>
        <LoginForm redirectTo={redirectTo} />
      </Suspense>
    </div>
  );
}

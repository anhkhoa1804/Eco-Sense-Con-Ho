import { redirect } from "next/navigation";
import { isAdminEmailAllowed, normalizeEmail } from "@/lib/auth/adminAllowlist";
import { createLocalAdminSession, isLocalAdminPasswordValid } from "@/lib/auth/localAdminSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function safeRedirect(value: string): string {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/admin";
}

async function loginAdmin(formData: FormData) {
  "use server";

  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const redirectTo = safeRedirect(String(formData.get("redirectTo") ?? "/admin"));
  const emailQuery = email ? `&email=${encodeURIComponent(email)}` : "";

  if (!email || !(await isAdminEmailAllowed(email))) {
    redirect(`/admin/login?error=unauthorized${emailQuery}`);
  }

  if (!isLocalAdminPasswordValid(password)) {
    redirect(`/admin/login?error=bad-password${emailQuery}`);
  }

  await createLocalAdminSession(email);
  redirect(redirectTo);
}

export function LoginForm({
  redirectTo,
  defaultEmail = "",
}: {
  redirectTo: string;
  defaultEmail?: string;
}) {
  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Đăng nhập quản trị</CardTitle>
        <CardDescription>
          Nhập email được cấp quyền và mật khẩu nội bộ của dự án. Không cần gửi liên kết email.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={loginAdmin} className="space-y-4">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <div className="space-y-2">
            <Label htmlFor="email">Địa chỉ email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue={defaultEmail}
              placeholder="ten@gmail.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mật khẩu quản trị</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="Nhập mật khẩu"
            />
          </div>
          <Button type="submit" className="w-full">
            Đăng nhập
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

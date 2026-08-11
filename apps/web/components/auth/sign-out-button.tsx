import { redirect } from "next/navigation";
import { clearLocalAdminSession } from "@/lib/auth/localAdminSession";
import { Button } from "@/components/ui/button";

async function signOut() {
  "use server";

  await clearLocalAdminSession();
  redirect("/admin/login");
}

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="outline">
        Đăng xuất
      </Button>
    </form>
  );
}

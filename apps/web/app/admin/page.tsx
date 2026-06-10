import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createRepositories } from "@/lib/repositories";

function stationStatusLabel(status: string): string {
  switch (status) {
    case "active":
      return "Đang hoạt động";
    case "maintenance":
      return "Bảo trì";
    case "offline":
      return "Ngoại tuyến";
    default:
      return status;
  }
}

export default async function AdminPage() {
  const { user, profile, scope } = await getSessionContext();

  if (!user) {
    redirect("/admin/login");
  }

  if (!profile || profile.role !== "admin" || !scope) {
    redirect("/admin/login?error=unauthorized");
  }

  const supabase = await createClient();
  const repos = createRepositories(supabase);
  const [stations, metrics] = await Promise.all([
    repos.stations.getAll(scope),
    repos.stations.getActiveCount(scope),
  ]);

  return (
    <div className="min-h-dvh bg-background px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-accent">Quản trị</p>
            <h1 className="text-3xl font-semibold tracking-tight">Bảng vận hành Cồn Hô</h1>
            <p className="mt-1 text-sm text-muted">{profile.email}</p>
          </div>
          <SignOutButton />
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Tổng quan trạm</CardTitle>
              <CardDescription>Số trạm đang hiển thị trong phạm vi quản trị của bạn</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-3xl font-semibold">
                {metrics.active}/{metrics.total}
              </p>
              <p className="text-sm text-muted">trạm đang hoạt động</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Lối tắt công khai</CardTitle>
              <CardDescription>Đi đến các trang người dùng đang xem</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Link href="/dashboard" className="block text-accent hover:underline">
                Bảng quan trắc
              </Link>
              <Link href="/report" className="block text-accent hover:underline">
                Báo cáo hiện trường
              </Link>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Danh sách trạm</CardTitle>
            <CardDescription>Thông tin nhanh về mạng lưới trạm công khai</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {stations.map((s) => (
                <li key={s.id} className="flex justify-between gap-4 border-b border-border/60 py-2">
                  <span>{s.name}</span>
                  <span className="text-muted">
                    {s.id} · {stationStatusLabel(s.status)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-muted">
              Các chức năng nâng cao như duyệt báo cáo hay cấu hình hệ thống vẫn dùng công cụ vận hành riêng.
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted">
          <Link href="/" className="text-accent hover:underline">
            ← Về trang công khai
          </Link>
        </p>
      </div>
    </div>
  );
}

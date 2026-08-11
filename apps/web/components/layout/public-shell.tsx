import Link from "next/link";
import { ClipboardList, Home, LayoutDashboard, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Trang chủ", icon: Home },
  { href: "/dashboard", label: "Quan trắc", icon: LayoutDashboard },
  { href: "/report", label: "Báo cáo", icon: ClipboardList },
];

export function PublicShell({
  children,
  activePath,
}: {
  children: React.ReactNode;
  activePath?: string;
}) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link href="/" className="group block">
            <p className="text-[11px] uppercase tracking-[0.28em] text-accent/90">Horizon</p>
            <h1 className="text-lg font-semibold tracking-tight transition-opacity group-hover:opacity-80">Quan trắc Cồn Hô</h1>
          </Link>
          <nav aria-label="Điều hướng chính" className="hidden items-center gap-2 md:flex">
            {links.map(({ href, label, icon: Icon }) => {
              const active = activePath === href || (href !== "/" && activePath?.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-foreground text-background"
                      : "text-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </Link>
              );
            })}
            <Link
              href="/admin/login"
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-muted transition-colors hover:text-foreground"
            >
              <Shield className="h-4 w-4" aria-hidden />
              Quản trị
            </Link>
          </nav>
        </div>
      </header>
      <main className="relative mx-auto max-w-7xl px-4 pb-28 pt-4 md:pb-14 md:pt-8">{children}</main>
      <nav
        aria-label="Điều hướng di động"
        className="fixed inset-x-0 bottom-0 z-50 bg-background/90 backdrop-blur md:hidden"
      >
        <ul className="mx-auto flex max-w-lg items-center justify-around px-3 py-3">
          {links.map(({ href, label, icon: Icon }) => {
            const active =
              activePath === href || (href !== "/" && (activePath?.startsWith(href) ?? false));
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "flex min-h-12 min-w-16 flex-col items-center gap-1 rounded-full px-3 py-2 text-xs",
                    active ? "bg-foreground text-background" : "text-muted",
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

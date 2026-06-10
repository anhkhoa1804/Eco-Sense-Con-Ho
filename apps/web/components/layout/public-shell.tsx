import Link from "next/link";
import { BookOpen, ClipboardList, Home, LayoutDashboard, Shield } from "lucide-react";
import { cn } from "@/lib/cn";

const links = [
  { href: "/", label: "Trang chủ", icon: Home },
  { href: "/about", label: "Giới thiệu", icon: BookOpen },
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
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="block">
            <p className="text-xs uppercase tracking-[0.18em] text-accent">Eco-Sense</p>
            <h1 className="text-lg font-semibold tracking-tight">Quan trắc Cồn Hô</h1>
          </Link>
          <nav aria-label="Điều hướng chính" className="hidden items-center gap-1 md:flex">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
                  activePath === href || (href !== "/" && activePath?.startsWith(href))
                    ? "bg-accent/10 text-accent"
                    : "text-muted hover:bg-muted/30 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </Link>
            ))}
            <Link
              href="/admin/login"
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted transition-colors hover:bg-muted/30 hover:text-foreground"
            >
              <Shield className="h-4 w-4" aria-hidden />
              Quản trị
            </Link>
          </nav>
        </div>
      </header>
      <main className="relative mx-auto max-w-6xl px-4 pb-24 pt-6 md:pb-10">{children}</main>
      <nav
        aria-label="Điều hướng di động"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur md:hidden"
      >
        <ul className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
          {links.map(({ href, label, icon: Icon }) => {
            const active =
              activePath === href || (href !== "/" && (activePath?.startsWith(href) ?? false));
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "flex min-h-11 min-w-14 flex-col items-center gap-1 rounded-xl px-2 py-2 text-xs",
                    active ? "text-accent" : "text-muted",
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

import Link from "next/link";
import { ClipboardList, Home, LayoutDashboard, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Primary navigation — the three public-facing destinations. Admin is
 * deliberately NOT part of this list: it's a different audience
 * (operators, not the public), so it gets its own small, consistently-
 * placed affordance in the header instead of a 4th primary nav item.
 * Previously, admin was appended only to the desktop nav's markup and
 * never added to the mobile bottom nav's list at all, so mobile visitors
 * had no way to reach it — this makes the separation explicit and
 * identical on both breakpoints instead of an accidental mobile gap.
 */
const links = [
  { href: "/", label: "Trang chủ", icon: Home },
  { href: "/dashboard", label: "Quan trắc", icon: LayoutDashboard },
  { href: "/report", label: "Báo cáo", icon: ClipboardList },
];

function isActive(href: string, activePath?: string): boolean {
  return activePath === href || (href !== "/" && (activePath?.startsWith(href) ?? false));
}

export function PublicShell({
  children,
  activePath,
}: {
  children: React.ReactNode;
  activePath?: string;
}) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-[var(--z-sticky)] border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link href="/" className="group block">
            <p className="text-[11px] uppercase tracking-[0.28em] text-accent/90">Horizon</p>
            <h1 className="text-lg font-semibold tracking-tight transition-opacity group-hover:opacity-80">Quan trắc Cồn Hô</h1>
          </Link>

          <div className="flex items-center gap-1">
            <nav aria-label="Điều hướng chính" className="hidden items-center gap-1 md:flex">
              {links.map(({ href, label, icon: Icon }) => {
                const active = isActive(href, activePath);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-sm px-3 py-2 text-sm font-medium transition-colors duration-[var(--motion-base)]",
                      active ? "bg-accent/10 text-accent" : "text-muted hover:bg-muted/20 hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {label}
                  </Link>
                );
              })}
            </nav>

            <div className="ml-1 h-6 w-px bg-border hidden md:block" aria-hidden />

            <Link
              href="/admin/login"
              aria-label="Quản trị"
              title="Quản trị"
              className="inline-flex h-10 w-10 items-center justify-center rounded-sm text-muted transition-colors duration-[var(--motion-base)] hover:bg-muted/20 hover:text-foreground"
            >
              <Shield className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-4 pb-28 pt-4 md:pb-14 md:pt-8">{children}</main>

      <nav
        aria-label="Điều hướng di động"
        className="fixed inset-x-0 bottom-0 z-[var(--z-drawer)] border-t border-border bg-background/95 backdrop-blur"
      >
        <ul className="mx-auto flex max-w-lg items-center justify-around px-3 py-2">
          {links.map(({ href, label, icon: Icon }) => {
            const active = isActive(href, activePath);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-12 min-w-16 flex-col items-center gap-1 rounded-sm px-3 py-2 text-xs transition-colors duration-[var(--motion-base)]",
                    active ? "text-accent" : "text-muted",
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                  <span className="font-medium">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

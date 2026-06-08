import Link from "next/link";
import { AlertTriangle, LayoutDashboard, MapPin, User } from "lucide-react";
import { cn } from "@/lib/cn";
import { BottomNav } from "./bottom-nav";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/alerts", label: "Alerts", icon: AlertTriangle },
  { href: "/profile", label: "Profile", icon: User },
];

export function AppShell({
  children,
  activePath,
}: {
  children: React.ReactNode;
  activePath?: string;
}) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(119,224,183,0.12),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(114,184,255,0.08),transparent_26%)]" />
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-accent">Eco-Sense</p>
            <h1 className="font-serif text-lg tracking-tight">Cồn Hô Farmer</h1>
          </div>
          <nav aria-label="Desktop navigation" className="hidden items-center gap-1 md:flex">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm",
                  activePath === href ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </Link>
            ))}
            <Link
              href="/dashboard"
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm",
                activePath?.startsWith("/stations") ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground",
              )}
            >
              <MapPin className="h-4 w-4" aria-hidden />
              Stations
            </Link>
          </nav>
        </div>
      </header>
      <main className="relative mx-auto max-w-6xl px-4 pb-24 pt-6 md:pb-8">{children}</main>
      <BottomNav />
    </div>
  );
}

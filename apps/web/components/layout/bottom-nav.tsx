"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, LayoutDashboard, MapPin, User } from "lucide-react";
import { cn } from "@/lib/cn";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/alerts", label: "Alerts", icon: AlertTriangle },
  { href: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur md:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`) || (href === "/dashboard" && pathname.startsWith("/stations"));
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex min-h-11 min-w-16 flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs",
                  active ? "text-accent" : "text-muted",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <Link
            href="/dashboard"
            className={cn(
              "flex min-h-11 min-w-16 flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs",
              pathname.startsWith("/stations") ? "text-accent" : "text-muted",
            )}
          >
            <MapPin className="h-5 w-5" aria-hidden />
            <span>Stations</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}

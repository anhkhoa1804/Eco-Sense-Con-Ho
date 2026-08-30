import { ClipboardList, Home, Info, LayoutDashboard, Shield } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/vi";

/**
 * Shared by SiteHeader's desktop nav, PublicShell's mobile bottom nav, and
 * Footer — one array so all three can never drift out of sync.
 *
 * Deliberately NOT exported from site-header.tsx (a "use client" module):
 * Footer and PublicShell's mobile nav are Server Components, and importing a
 * plain data value from a "use client" module into a Server Component
 * resolves to an opaque client reference, not the actual array — this file
 * has no "use client" boundary, so the value is a normal export everywhere.
 *
 * Each entry carries a dictionary KEY rather than a literal label. The label
 * a reader sees now depends on their locale, and there are three separate
 * renderers of this list — hardcoding Vietnamese here would have meant
 * translating it in three places and letting them drift.
 */
export type NavKey = keyof Dictionary["nav"];

export const PUBLIC_NAV_LINKS = [
  { href: "/", key: "home", icon: Home },
  { href: "/about", key: "about", icon: Info },
  { href: "/dashboard", key: "monitoring", icon: LayoutDashboard },
  { href: "/report", key: "report", icon: ClipboardList },
] as const satisfies readonly { href: string; key: NavKey; icon: unknown }[];

export const ADMIN_NAV_LINK = { href: "/admin", key: "admin", icon: Shield } as const;

/**
 * The full five-item global navigation, admin included.
 *
 * Admin used to be split out of the nav array and rendered separately behind
 * a divider — which made it read as a different class of destination, and
 * left the mobile bar with only four. It is a hierarchy distinction, not a
 * different navigation: same list, same treatment, everywhere.
 */
export const PRIMARY_NAV_LINKS = [...PUBLIC_NAV_LINKS, ADMIN_NAV_LINK] as const;

export function isPublicNavActive(href: string, activePath?: string): boolean {
  return activePath === href || (href !== "/" && (activePath?.startsWith(href) ?? false));
}

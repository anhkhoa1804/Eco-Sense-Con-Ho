import { ClipboardList, Home, Info, LayoutDashboard } from "lucide-react";

/**
 * Shared by SiteHeader's desktop nav, PublicShell's mobile bottom nav, and
 * Footer — one array so all three can never drift out of sync. Order:
 * Trang chủ, Giới thiệu, Quan trắc, Báo cáo — Giới thiệu immediately
 * follows Trang chủ.
 *
 * Deliberately NOT exported from site-header.tsx (a "use client" module):
 * Footer and PublicShell's mobile nav are Server Components, and importing
 * a plain data value from a "use client" module into a Server Component
 * resolves to an opaque client reference, not the actual array — this file
 * has no "use client" boundary, so the value is a normal export everywhere.
 */
export const PUBLIC_NAV_LINKS = [
  { href: "/", label: "Trang chủ", icon: Home },
  { href: "/about", label: "Giới thiệu", icon: Info },
  { href: "/dashboard", label: "Quan trắc", icon: LayoutDashboard },
  { href: "/report", label: "Báo cáo", icon: ClipboardList },
] as const;

export function isPublicNavActive(href: string, activePath?: string): boolean {
  return activePath === href || (href !== "/" && (activePath?.startsWith(href) ?? false));
}

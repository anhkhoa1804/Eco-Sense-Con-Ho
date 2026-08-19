"use client";

import type * as React from "react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/ui/wordmark";
import { isPublicNavActive, PUBLIC_NAV_LINKS } from "@/lib/publicNav";

/**
 * Tracks only the boundary crossing (scrolled past `threshold`), not
 * continuous scroll position — the actual size change is a CSS transition
 * on .silent-header/.is-compressed (globals.css); this just supplies the
 * class. One state flip per crossing, no animation library, no per-frame
 * work.
 */
function useHeaderScrollCompress(threshold = 8): boolean {
  const [compressed, setCompressed] = useState(false);

  useEffect(() => {
    const onScroll = () => setCompressed(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return compressed;
}

interface SiteHeaderProps {
  /**
   * Both registers render the exact same global navigation now — "register"
   * only decides whether the admin operational strip (email/actions) is
   * appended below it and which item shows as active. Admin is a hierarchy
   * distinction, not a different header: hiding the public nav on admin
   * pages was the thing the design direction explicitly asked to stop doing.
   */
  register?: "public" | "admin";
  /** Public register only — drives nav active-state. */
  activePath?: string;
  /** Admin register only. */
  adminEmail?: string;
  adminActions?: React.ReactNode;
}

const ADMIN_ITEM = { href: "/admin", label: "Quản trị" };

function NavLink({
  href,
  label,
  active,
  icon: Icon,
  className,
}: {
  href: string;
  label: string;
  active: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-2 rounded-sm px-3 py-2 text-sm font-medium transition-colors duration-[var(--motion-base)]",
        active ? "nav-link-active text-accent" : "text-muted hover:bg-muted/20 hover:text-foreground",
        className,
      )}
    >
      {Icon ? <Icon className="h-4 w-4" aria-hidden /> : null}
      {label}
    </Link>
  );
}

export function SiteHeader({ register = "public", activePath, adminEmail, adminActions }: SiteHeaderProps) {
  const compressed = useHeaderScrollCompress();
  const inAdmin = register === "admin";
  const hasOperationalStrip = inAdmin && Boolean(adminEmail || adminActions);

  return (
    // .silent-header's fixed-height + overflow-hidden lives on the inner row
    // now, not the <header> itself — that leaves room for the admin
    // operational strip to sit below it without being clipped by the
    // scroll-compress box it has nothing to do with.
    <header className="sticky top-0 z-[var(--z-sticky)] border-b border-border bg-background/95 backdrop-blur-sm">
      <div className={cn("silent-header overflow-hidden", compressed && "is-compressed")}>
        <div className="mx-auto flex h-full max-w-[var(--width-content-wide)] items-center justify-between px-4">
          <Wordmark href={inAdmin ? "/admin" : "/"} />

          <div className="flex items-center gap-1">
            <nav aria-label="Điều hướng chính" className="hidden items-center gap-1 md:flex">
              {PUBLIC_NAV_LINKS.map(({ href, label, icon }) => (
                <NavLink key={href} href={href} label={label} icon={icon} active={!inAdmin && isPublicNavActive(href, activePath)} />
              ))}
              <div className="mx-1 h-5 w-px bg-border" aria-hidden />
              <NavLink href={ADMIN_ITEM.href} label={ADMIN_ITEM.label} icon={Shield} active={inAdmin} />
            </nav>

            {/* Mobile keeps only an icon affordance for admin — the four
                public items already live in PublicShell's bottom tab bar. */}
            <Link
              href={ADMIN_ITEM.href}
              aria-label={ADMIN_ITEM.label}
              title={ADMIN_ITEM.label}
              aria-current={inAdmin ? "page" : undefined}
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-sm transition-colors duration-[var(--motion-base)] md:hidden",
                inAdmin ? "text-accent" : "text-muted hover:bg-muted/20 hover:text-foreground",
              )}
            >
              <Shield className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </div>

      {hasOperationalStrip ? (
        <div className="border-t border-border/60 bg-muted/10">
          <div className="mx-auto flex max-w-[var(--width-content-wide)] flex-wrap items-center justify-between gap-3 px-4 py-2">
            {adminEmail ? <p className="text-xs text-muted">{adminEmail}</p> : <span aria-hidden />}
            {adminActions ? <div className="flex flex-wrap items-center gap-3">{adminActions}</div> : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}

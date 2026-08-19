"use client";

import type * as React from "react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/ui/wordmark";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { isPublicNavActive, PRIMARY_NAV_LINKS } from "@/lib/publicNav";

/**
 * Tracks only the boundary crossing (scrolled past `threshold`), not
 * continuous scroll position — one state flip per crossing, so nothing runs
 * while the reader sits still and there is no per-frame work.
 *
 * The single resulting class drives *every* dependent measure at once:
 * header height, wordmark height, and the backdrop. They interpolate from
 * one source (`--header-h` / `--header-logo` in globals.css), which is what
 * keeps the mark from snapping between two sizes the way a class swap did.
 */
function useScrolledPast(threshold = 12): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return scrolled;
}

interface SiteHeaderProps {
  /**
   * Both registers render the exact same global navigation — "register" only
   * decides whether the admin operational strip is appended below it. Admin
   * is a hierarchy distinction, not a different product.
   */
  register?: "public" | "admin";
  activePath?: string;
  adminEmail?: string;
  adminActions?: React.ReactNode;
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative inline-flex items-center px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.13em]",
        "transition-colors duration-[var(--motion-base)]",
        active ? "text-foreground" : "text-foreground-muted hover:text-foreground",
      )}
    >
      {label}
      {/* A brand-gradient rule under the active item, not a filled chip: the
          header is a transparent part of the page canvas, and a solid
          background would reintroduce the separate-panel layer this pass
          removed. The gradient is the same green→orange sweep as the mark,
          so the active state is a brand gesture rather than a generic bar. */}
      {active ? (
        <span
          aria-hidden
          className="nav-underline absolute inset-x-3 bottom-1 h-[2px] rounded-full bg-gradient-to-r from-brand-green to-brand-orange"
        />
      ) : null}
    </Link>
  );
}

export function SiteHeader({ register = "public", activePath, adminEmail, adminActions }: SiteHeaderProps) {
  const scrolled = useScrolledPast();
  const inAdmin = register === "admin";
  const hasOperationalStrip = inAdmin && Boolean(adminEmail || adminActions);

  /** Admin owns its own active item; the public path never highlights there. */
  const isActive = (href: string) =>
    href === "/admin" ? inAdmin : !inAdmin && isPublicNavActive(href, activePath);

  return (
    <header
      className={cn(
        "site-header sticky top-0 z-[var(--z-sticky)]",
        scrolled && "is-compact",
        // Transparent at rest so the drafting grid runs straight through the
        // header. The backdrop is earned, not permanent: it appears only once
        // content is actually sliding underneath, which is the only moment it
        // is needed for readability.
        "transition-[background-color,border-color,backdrop-filter] duration-[var(--motion-medium)] ease-[var(--ease-brand)]",
        scrolled
          ? "border-b border-border bg-canvas/75 backdrop-blur-xl supports-[backdrop-filter]:bg-canvas/60"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div
        className={cn(
          "h-wide flex items-center justify-between gap-6",
          // Height interpolates from --header-h, which .is-compact reassigns.
          "h-[var(--header-h)] transition-[height] duration-[var(--motion-slow)] ease-[var(--ease-brand)]",
        )}
      >
        <Wordmark href={inAdmin ? "/admin" : "/"} markSize="fluid" />

        <div className="flex items-center gap-2">
          <nav aria-label="Điều hướng chính" className="hidden items-center gap-1 lg:flex">
            {PRIMARY_NAV_LINKS.map(({ href, label }) => (
              <NavLink key={href} href={href} label={label} active={isActive(href)} />
            ))}
          </nav>

          {/*
            Reserved slot. Phase 8's VI | EN selector lands here, beside the
            theme toggle and inside the same flex cluster — so adding it costs
            roughly one toggle's width and cannot push the nav into the mark.
            Deliberately renders nothing today: a visible switcher that cannot
            switch is worse than no switcher.
          */}
          <div className="hidden h-6 w-px bg-border lg:block" aria-hidden />
          <ThemeToggle />
        </div>
      </div>

      {hasOperationalStrip ? (
        <div className="border-t border-border/60">
          <div className="h-wide flex flex-wrap items-center justify-between gap-3 py-2">
            {adminEmail ? <p className="text-xs text-foreground-muted">{adminEmail}</p> : <span aria-hidden />}
            {adminActions ? <div className="flex flex-wrap items-center gap-3">{adminActions}</div> : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}

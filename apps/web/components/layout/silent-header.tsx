"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

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

/**
 * R2 — the silent header. Logo only (Wordmark's showTitle={false} already
 * removed the tagline in R21); this adds the scroll-compress behavior
 * (72px → 56px, FRONTEND_REBUILD_SPECIFICATION.md §7) as the one new piece
 * of interactivity. Kept as a small client boundary so PublicShell itself
 * stays a Server Component — only the height-tracking bit needs the client.
 */
export function SilentHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  const compressed = useHeaderScrollCompress();

  return (
    <header
      className={cn(
        "silent-header sticky top-0 z-[var(--z-sticky)] overflow-hidden border-b border-border bg-background/95 backdrop-blur-sm",
        compressed && "is-compressed",
        className,
      )}
    >
      {children}
    </header>
  );
}

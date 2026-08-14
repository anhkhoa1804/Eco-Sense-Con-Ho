import Link from "next/link";
import { cn } from "@/lib/utils";

interface WordmarkProps {
  title: string;
  href?: string;
  /** The title line's element — `h1` on the page's single true heading (PublicShell, AdminShell), `p` elsewhere (e.g. admin login, which has its own heading). */
  titleAs?: "h1" | "p";
  /** `sm` (default) is persistent nav-branding size, matching PublicShell/admin login. `lg` carries page-title weight — for AdminShell, which has no separate content h1. */
  titleSize?: "sm" | "lg";
  /**
   * Renders the real `logo.png` brand mark beside the title, replacing the
   * hand-typed "Horizon" eyebrow (the mark already reads as the wordmark).
   * Defaults to false — admin's working console (`AdminShell`) relies on
   * this default to stay mark-free without passing anything, per
   * REDESIGN_SPECIFICATION.md §24.11 ("never in admin's working console").
   */
  showMark?: boolean;
  /** `header` (default, 32px mobile / 44px desktop) for persistent nav branding — the logo carries the brand alone here. `login` (48px / 56px) for the dedicated, more prominent admin-login treatment. */
  markSize?: "header" | "login";
  /** Renders `title` as visible text next to the mark. Defaults to true; set false when the mark alone should carry the brand (its `alt="Horizon"` still gives the link an accessible name). */
  showTitle?: boolean;
  className?: string;
}

const titleSizeClasses: Record<NonNullable<WordmarkProps["titleSize"]>, string> = {
  sm: "text-lg",
  lg: "text-h1",
};

/** logo.png's real aspect ratio (829×301) — used only as the width/height CLS hint; actual display size comes from markSizeClasses. */
const LOGO_ASPECT_RATIO = 829 / 301;
const LOGO_INTRINSIC_HEIGHT = 200;

const markSizeClasses: Record<NonNullable<WordmarkProps["markSize"]>, string> = {
  header: "h-8 md:h-11",
  login: "h-12 md:h-14",
};

/**
 * The "Horizon" eyebrow + title pattern, previously hand-typed identically
 * in public-shell.tsx and admin/login/page.tsx (REDESIGN_SPECIFICATION.md §10).
 * `showMark` swaps the text eyebrow for the real logo asset (§24.11).
 */
export function Wordmark({
  title,
  href = "/",
  titleAs = "p",
  titleSize = "sm",
  showMark = false,
  markSize = "header",
  showTitle = true,
  className,
}: WordmarkProps) {
  const TitleTag = titleAs;
  return (
    <Link href={href} className={cn("group inline-flex items-center", showMark && showTitle ? "gap-3" : "block", className)}>
      {showMark ? (
        // Plain <img>, not next/image: this is a small, fixed local static
        // asset with a known aspect ratio — none of next/image's automatic
        // format/responsive-srcset optimization is needed, and next/image
        // was crashing at render time with a module-resolution error
        // unrelated to the asset itself.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/logo.png"
          alt="Horizon"
          width={Math.round(LOGO_INTRINSIC_HEIGHT * LOGO_ASPECT_RATIO)}
          height={LOGO_INTRINSIC_HEIGHT}
          className={cn(
            "w-auto shrink-0 transition-opacity duration-[var(--motion-base)] group-hover:opacity-80",
            markSizeClasses[markSize],
          )}
        />
      ) : (
        <p className="text-eyebrow uppercase tracking-[0.2em] text-accent/90">Horizon</p>
      )}
      {showTitle ? (
        <TitleTag
          className={cn(
            "font-semibold tracking-tight transition-opacity duration-[var(--motion-base)] group-hover:opacity-80",
            titleSizeClasses[titleSize],
          )}
        >
          {title}
        </TitleTag>
      ) : null}
    </Link>
  );
}

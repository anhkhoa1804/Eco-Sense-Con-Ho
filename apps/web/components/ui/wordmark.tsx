import Link from "next/link";
import { cn } from "@/lib/utils";

interface WordmarkProps {
  href?: string;
  /** `header` (default, 40px mobile / 56px desktop) — the one size every current call site uses. */
  markSize?: "header";
  className?: string;
}

/** logo.png's real aspect ratio (829×301) — used only as the width/height CLS hint. */
const LOGO_ASPECT_RATIO = 829 / 301;
const LOGO_INTRINSIC_HEIGHT = 200;

const markSizeClasses: Record<NonNullable<WordmarkProps["markSize"]>, string> = {
  header: "h-10 md:h-14",
};

/**
 * The real logo.png mark, linked home — the sole brand lockup used across
 * every header/footer surface (public, admin console, admin login) since
 * SiteHeader unified them. Mark-only: the mark already reads as the
 * wordmark, so there's no separate text title to configure.
 */
export function Wordmark({ href = "/", markSize = "header", className }: WordmarkProps) {
  return (
    <Link href={href} className={cn("group inline-block", className)}>
      {/* Plain <img>, not next/image: small fixed local asset, known aspect
          ratio; next/image previously crashed at render time here with a
          module-resolution error unrelated to the asset itself. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="HORIZON"
        width={Math.round(LOGO_INTRINSIC_HEIGHT * LOGO_ASPECT_RATIO)}
        height={LOGO_INTRINSIC_HEIGHT}
        className={cn(
          "w-auto shrink-0 transition-opacity duration-[var(--motion-base)] group-hover:opacity-80",
          markSizeClasses[markSize],
        )}
      />
    </Link>
  );
}

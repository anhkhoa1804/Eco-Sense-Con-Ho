import Link from "next/link";
import { cn } from "@/lib/utils";

interface WordmarkProps {
  href?: string;
  /**
   * `fluid`   — height follows the `--header-logo` custom property and
   *             transitions with it. This is what makes the mark read as one
   *             continuous object gently compacting on scroll instead of
   *             snapping between two discrete sizes, which is what a class
   *             swap (h-16 → h-12) produced.
   * `compact` — footer / secondary surfaces, where the mark is a signature
   *             rather than a brand anchor.
   */
  markSize?: "fluid" | "compact";
  className?: string;
}

/** The wordmark's real aspect ratio (829×301) — used only as the width/height CLS hint. */
const LOGO_ASPECT_RATIO = 829 / 301;
const LOGO_INTRINSIC_HEIGHT = 200;

const markSizeClasses: Record<NonNullable<WordmarkProps["markSize"]>, string> = {
  // The transition is on `height`, and the value comes from a var the header
  // reassigns — so one class change on the header interpolates the mark.
  fluid: "h-[var(--header-logo)] transition-[height] duration-[var(--motion-slow)] ease-[var(--ease-brand)]",
  compact: "h-8",
};

/**
 * The real HORIZON wordmark, linked home — the sole brand lockup across every
 * header/footer surface. Mark-only: the mark already reads as the wordmark,
 * so there is no separate text title to configure.
 */
export function Wordmark({ href = "/", markSize = "fluid", className }: WordmarkProps) {
  return (
    <Link href={href} aria-label="HORIZON — trang chủ" className={cn("group inline-flex items-center", className)}>
      {/* Plain <img>, not next/image: small fixed local asset with a known
          aspect ratio; next/image previously crashed at render time here with
          a module-resolution error unrelated to the asset itself. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/brand/horizon-wordmark.png"
        alt="HORIZON"
        width={Math.round(LOGO_INTRINSIC_HEIGHT * LOGO_ASPECT_RATIO)}
        height={LOGO_INTRINSIC_HEIGHT}
        className={cn("w-auto shrink-0", markSizeClasses[markSize])}
      />
    </Link>
  );
}

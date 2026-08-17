import { cn } from "@/lib/utils";

/**
 * Layout shell for the future homepage rebuild (R4) — structure only, no
 * content yet, per FRONTEND_REBUILD_SPECIFICATION.md §12/§13. Not wired
 * into the live "/" route in this phase.
 *
 * `register` sets vertical rhythm density, not color. Per the audit's own
 * §7 conclusion, "monitoring" stays on the same light base as "story" —
 * dark was explicitly rejected (collides with the light CartoDB map, the
 * warm illustrative logo, and the brand/status color-collision rule).
 * Density is what actually differentiates a monitoring page from a
 * marketing one, not a theme switch. This intentionally reconciles the
 * three-register visual model with §6's dark-first rejection rather than
 * reintroducing a dark surface here.
 */
interface ObservatoryShellProps {
  register?: "story" | "monitoring";
  children: React.ReactNode;
  className?: string;
}

export function ObservatoryShell({ register = "story", children, className }: ObservatoryShellProps) {
  return (
    <div
      data-observatory-register={register}
      className={cn("flex flex-col", register === "story" ? "gap-32" : "gap-12", className)}
    >
      {children}
    </div>
  );
}

type ActWidth = "reading" | "content" | "full-bleed";

interface ObservatoryActProps {
  id?: string;
  eyebrow?: string;
  title?: string;
  /**
   * reading  — prose only, capped at --width-reading (68ch)
   * content  — the default grid, --width-content up to 1536px then --width-content-wide
   * full-bleed — escapes to the viewport edge via .full-bleed; inner content still
   *              capped at --width-content-wide. At most one per viewport height (§12).
   */
  width?: ActWidth;
  className?: string;
  children?: React.ReactNode;
}

export function ObservatoryAct({ id, eyebrow, title, width = "content", className, children }: ObservatoryActProps) {
  const heading =
    eyebrow || title ? (
      <div className="space-y-2">
        {eyebrow ? <p className="text-eyebrow uppercase tracking-[0.18em] text-accent">{eyebrow}</p> : null}
        {title ? <h2 className="text-display font-semibold tracking-tight">{title}</h2> : null}
      </div>
    ) : null;

  // .full-bleed already sets an explicit width (100vw), so this branch
  // doesn't hit the flex-cross-axis sizing issue handled below — its inner
  // div is a normal block child, not a flex item.
  if (width === "full-bleed") {
    return (
      <section id={id} className={cn("full-bleed min-w-0", className)}>
        <div className="mx-auto max-w-[var(--width-content-wide)] space-y-6 px-4">
          {heading}
          {children}
        </div>
      </section>
    );
  }

  return (
    <section
      id={id}
      className={cn(
        // w-full is required, not just max-w — as a flex item (a direct
        // child of ObservatoryShell's flex column), this section's cross-
        // axis size does not reliably resolve to "fill available space" from
        // max-width/min-w-0 alone; a wide descendant several levels down
        // (e.g. a table inside its own overflow-x-auto wrapper) can pull the
        // section's own auto width up to its content size instead. w-full
        // pins it to the container, and max-w still caps it on wide screens.
        "mx-auto w-full min-w-0 space-y-6 overflow-x-hidden px-4",
        width === "reading" ? "max-w-[var(--width-reading)]" : "max-w-[var(--width-content)] lg:max-w-[var(--width-content-wide)]",
        className,
      )}
    >
      {heading}
      {children}
    </section>
  );
}

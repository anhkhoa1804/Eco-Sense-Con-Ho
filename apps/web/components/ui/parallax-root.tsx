"use client";

import { useEffect } from "react";

/**
 * Publishes the page's scroll offset as a single CSS custom property,
 * `--parallax`, on <html>.
 *
 * One listener for the whole document, rather than one per decorative layer.
 * Anything that wants depth reads the variable and multiplies it by its own
 * factor (see `.horizon-dotfield::before`), so layers move at different rates
 * from one shared source of truth and can never drift out of sync.
 *
 * Why a variable driving `transform` rather than `background-attachment:
 * fixed`, which this replaces: fixed-attachment backgrounds are among the few
 * things browsers cannot hand to the compositor, so they repaint a
 * viewport-sized surface on every scroll frame. That was the dominant cause
 * of the scroll shake reported on this page. A translated layer stays on the
 * compositor thread.
 *
 * Cost control:
 *  - the listener is passive and only schedules; every read happens inside
 *    the rAF callback, so scrolling never forces a synchronous reflow
 *  - at most one update per animation frame
 *  - the offset is clamped, because past the hero the layer is masked out
 *    anyway and there is no reason to keep writing style on a long page
 *  - honours `prefers-reduced-motion` by never starting at all
 */
export function ParallaxRoot() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const root = document.documentElement;
    let frame = 0;
    let scheduled = false;
    let last = -1;

    const write = () => {
      scheduled = false;
      // The whole-page atmosphere consumes this now, not just the hero, so
      // the ceiling is 3 viewports rather than 1.5. It stays clamped because
      // the pool layer translates and has finite slack (see
      // `.horizon-atmosphere::after`, inset: -25%); an unbounded offset would
      // eventually drag its edge into view on a very long page.
      const offset = Math.min(window.scrollY, window.innerHeight * 3);
      const rounded = Math.round(offset);
      if (rounded === last) return;
      last = rounded;
      root.style.setProperty("--parallax", `${rounded}px`);
    };

    const onScroll = () => {
      if (scheduled) return;
      scheduled = true;
      frame = requestAnimationFrame(write);
    };

    write();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
      root.style.removeProperty("--parallax");
    };
  }, []);

  return null;
}

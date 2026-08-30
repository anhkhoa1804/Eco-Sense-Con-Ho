import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";

/**
 * ONE GLOBAL BACKGROUND TEXTURE, EVER.
 *
 * The owner reported the pages looking busy, and the cause was two global
 * textures on screen at once: the survey grid on `.horizon-atmosphere`, plus
 * a 26px dot field attached to the shared `PageHero`. Neither looked wrong on
 * its own, they lived in different files, and every page used both — so the
 * defect was invisible in review and obvious in a screenshot.
 *
 * These tests pin the convention that replaced it:
 *
 *   1. `.horizon-atmosphere` is the SINGLE owner of whole-page background
 *      layers — grid, gradient pools, vignette, parallax drift.
 *   2. No other rule may paint a repeating/viewport-spanning texture.
 *   3. Exactly one BackgroundAtmosphere is mounted, in the root layout.
 *
 * A component that needs decoration inside its own box is unaffected: the
 * rule is about textures that span the viewport, not about styling a card.
 */

const CSS = path.join(process.cwd(), "app", "globals.css");

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

describe("single global background", () => {
  it("routes every whole-page texture through .horizon-atmosphere", () => {
    const css = stripComments(fs.readFileSync(CSS, "utf8"));

    // A repeating texture is a background-image paired with a background-size
    // small enough to tile. Those two together are what makes a "field".
    const tiled: string[] = [];
    const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = ruleRe.exec(css))) {
      const [, selector, body] = m;
      if (!/background-image\s*:/.test(body)) continue;
      const size = body.match(/background-size\s*:\s*([^;]+)/);
      const isTiled =
        (size && /\b\d+px\s+\d+px/.test(size[1])) || /repeating-(linear|radial)-gradient/.test(body);
      if (isTiled && !selector.includes("horizon-atmosphere")) {
        tiled.push(selector.trim().slice(0, 70));
      }
    }

    assert.deepEqual(
      tiled,
      [],
      `A second global texture appeared. Whole-page backgrounds belong in BackgroundAtmosphere:\n  ${tiled.join("\n  ")}`,
    );
  });

  it("has removed the dot field rather than merely hiding it", () => {
    const css = fs.readFileSync(CSS, "utf8");
    const live = stripComments(css);

    assert.ok(!/\.horizon-dotfield\s*\{/.test(live), ".horizon-dotfield is back as a live rule");
    assert.ok(!/--h-dot-ink\s*:/.test(live), "--h-dot-ink is back — the dot field is returning");
    // The explanatory note must survive, or the next person re-adds it.
    assert.ok(css.includes("THE DOT FIELD IS GONE"), "the note explaining why was deleted");
  });

  it("mounts exactly one BackgroundAtmosphere, in the root layout", () => {
    const roots = ["app", "components"].map((d) => path.join(process.cwd(), d));
    const mounts: string[] = [];

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx$/.test(entry.name)) {
          const src = fs.readFileSync(full, "utf8");
          const rel = path.relative(process.cwd(), full).split(path.sep).join("/");
          if (rel.endsWith("background-atmosphere.tsx")) continue;
          if (/<BackgroundAtmosphere\b/.test(src)) mounts.push(rel);
          // The raw class may only appear inside the component itself.
          if (/className="[^"]*horizon-atmosphere/.test(src)) mounts.push(`${rel} (raw class)`);
        }
      }
    };
    for (const r of roots) if (fs.existsSync(r)) walk(r);

    assert.deepEqual(mounts, ["app/layout.tsx"], `expected exactly one mount, got: ${mounts.join(", ")}`);
  });

  it("keeps the atmosphere behind content and out of the accessibility tree", () => {
    const component = fs.readFileSync(
      path.join(process.cwd(), "components", "layout", "background-atmosphere.tsx"),
      "utf8",
    );
    assert.match(component, /aria-hidden/, "atmosphere must not be announced");

    const css = stripComments(fs.readFileSync(CSS, "utf8"));
    const rule = css.match(/\.horizon-atmosphere\s*\{([^}]*)\}/);
    assert.ok(rule, ".horizon-atmosphere rule missing");
    assert.match(rule[1], /position:\s*fixed/);
    assert.match(rule[1], /z-index:\s*-1/);
    assert.match(rule[1], /pointer-events:\s*none/);
  });
});

/**
 * Hero scale.
 *
 * The homepage hero was capped at 40rem, so on a 900px window it filled 71%
 * of the viewport and read as the top of a document rather than a landing
 * page. These pin the corrected geometry at the source level — the visual
 * result still needs a screenshot, but a regression in the CSS itself will
 * fail here first.
 */
describe("hero geometry", () => {
  const heroSrc = () =>
    fs.readFileSync(path.join(process.cwd(), "components", "layout", "page-hero.tsx"), "utf8");

  it("gives the display hero a viewport-proportional height with no fixed cap", () => {
    const src = heroSrc();
    assert.match(src, /min-h-\[calc\(88svh-var\(--header-h\)\)\]/, "display hero lost its 88svh height");
    assert.ok(!/min-h-\[clamp\([^)]*40rem\)\]/.test(src), "the 40rem cap is back — it is what made the hero short");
  });

  it("uses svh rather than vh, so mobile browser chrome cannot clip it", () => {
    assert.ok(!/min-h-\[calc\(88vh/.test(heroSrc()), "vh lets mobile toolbars clip the hero");
  });

  it("subtracts the header, so header + hero stay inside one screen", () => {
    // Without the subtraction the hero's own 88svh sits BELOW an ~64px header
    // and the composition overflows the first viewport.
    assert.match(heroSrc(), /88svh-var\(--header-h\)/);
  });

  it("keeps the reveal slow enough to be perceived as motion", () => {
    const css = fs.readFileSync(CSS, "utf8");
    const reveal = css.match(/--motion-reveal:\s*(\d+)ms/);
    assert.ok(reveal, "--motion-reveal is missing");
    const ms = Number(reveal[1]);
    assert.ok(ms >= 500 && ms <= 900, `reveal at ${ms}ms is outside the perceptible-but-not-theatrical range`);
  });

  it("keeps the parallax layer's travel inside its slack", () => {
    // If the pool factor ever outgrows the inset, the layer's edge drags into
    // view near the bottom of a long page.
    const css = fs.readFileSync(CSS, "utf8");
    const factor = Number(css.match(/var\(--parallax, 0px\) \* -([\d.]+)\)/)?.[1]);
    const slack = Number(css.match(/inset: -(\d+)%/)?.[1]) / 100;
    assert.ok(factor > 0 && slack > 0, "could not read the parallax budget");
    // --parallax is clamped to 3 viewports in parallax-root.tsx.
    assert.ok(factor * 3 < slack, `travel ${(factor * 3).toFixed(2)}vh exceeds slack ${slack.toFixed(2)}vh`);
  });
});

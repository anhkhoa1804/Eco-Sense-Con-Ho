"use client";

import Link from "next/link";
import { Wordmark } from "@/components/ui/wordmark";
import { useDict } from "@/lib/i18n/client";
import { PRIMARY_NAV_LINKS } from "@/lib/publicNav";

/**
 * A project footer, not a marketing footer.
 *
 * ONE ROW on desktop. It carries five facts — brand, place, navigation,
 * copyright, and the basemap credit — and five facts do not justify the
 * stacked block this replaced, which spent two rows and a hairline on them
 * and made the end of every page feel heavier than the page.
 *
 * The map attribution is here rather than inside the map itself. Esri and OSM
 * require the credit be DISPLAYED, not that it sit in the map frame; printing
 * it once at the foot of the document satisfies that while keeping it out of
 * the most visually expensive cell on the Monitoring canvas. It is the
 * quietest thing in the footer, and deliberately the last.
 *
 * No "project/technical links" column: this repository has no verified public
 * URL to point at, and inventing one would violate the same data-honesty rule
 * the product is built around.
 */
export function Footer() {
  const dict = useDict();

  return (
    // pb-24 clears the fixed mobile bottom nav so the footer's tail is never
    // hidden behind it — md:pb-0 because that nav is md:hidden.
    <footer className="mt-28 pb-24 md:pb-0">
      <div className="h-wide">
        <div className="border-t border-border/70 py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
            <div className="flex items-center gap-4">
              <Wordmark markSize="compact" />
              <span className="h-5 w-px bg-border" aria-hidden />
              <p className="text-sm text-foreground-muted">{dict.footer.place}</p>
            </div>

            <nav aria-label={dict.nav.footerLabel} className="lg:flex-1 lg:px-4">
              <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] lg:justify-center">
                {PRIMARY_NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-foreground-subtle transition-colors duration-[var(--motion-base)] hover:text-foreground"
                    >
                      {dict.nav[link.key]}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <p className="shrink-0 text-[13px] text-foreground-muted [font-family:var(--font-data)]">
              {dict.footer.copyright}
            </p>
          </div>

          <p className="mt-5 text-[11px] leading-relaxed text-foreground-subtle">
            {dict.footer.mapAttribution}
          </p>
        </div>
      </div>
    </footer>
  );
}

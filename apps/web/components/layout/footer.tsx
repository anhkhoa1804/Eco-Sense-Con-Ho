"use client";

import Link from "next/link";
import { Wordmark } from "@/components/ui/wordmark";
import { useDict } from "@/lib/i18n/client";
import { PRIMARY_NAV_LINKS } from "@/lib/publicNav";

/**
 * A project footer, not a marketing footer.
 *
 * It carries five facts — brand, place, navigation, map attribution,
 * copyright — so it gets the space five facts deserve: one row plus a
 * hairline, transparent over the same atmosphere as the rest of the page.
 * Everything here is one step down in contrast from body text, so the footer
 * closes the page instead of competing with it.
 *
 * No "project/technical links" column: this repository has no verified
 * public URL to point at, and inventing one would violate the same
 * data-honesty rule the product is built around.
 */
export function Footer() {
  const dict = useDict();

  return (
    // pb-24 clears the fixed mobile bottom nav so the footer's tail is never
    // hidden behind it — md:pb-0 because that nav is md:hidden.
    <footer className="mt-28 pb-24 md:pb-0">
      <div className="h-wide">
        <div className="border-t border-border/70 pt-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Wordmark markSize="compact" />
              <span className="h-6 w-px bg-border" aria-hidden />
              <p className="text-sm text-foreground-muted">{dict.footer.place}</p>
            </div>

            <nav aria-label={dict.nav.footerLabel}>
              <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px]">
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
          </div>

          <div className="mt-6 flex flex-col gap-1.5 pb-8 text-[11px] text-foreground-subtle sm:flex-row sm:items-center sm:justify-between">
            <p>{dict.footer.mapAttribution}</p>
            <p className="[font-family:var(--font-data)]">{dict.footer.copyright}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

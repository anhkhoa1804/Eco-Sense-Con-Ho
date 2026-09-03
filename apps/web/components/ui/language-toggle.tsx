"use client";

import { cn } from "@/lib/utils";
import { setLocaleCookie, useDict, useLocale } from "@/lib/i18n/client";
import { LOCALE_LABEL, LOCALES, LOCALE_FULL_LABEL, type Locale } from "@/lib/i18n/config";

/**
 * VI | EN switcher.
 *
 * A real two-option control rather than a dropdown: with exactly two locales,
 * a select would hide one behind an interaction for no benefit, and both
 * options being visible makes it obvious the site has an English edition at
 * all.
 *
 * Accessibility: rendered as a radiogroup, because that is what it is — a
 * choice between mutually exclusive options, not two independent buttons.
 * Each option carries `aria-checked` and a full-language accessible name
 * ("Switch to Vietnamese") so a screen reader announces the destination
 * rather than reading out the two letters "V" and "I".
 */
export function LanguageToggle({ className }: { className?: string }) {
  const current = useLocale();
  const dict = useDict();

  const accessibleName: Record<Locale, string> = {
    vi: dict.controls.switchToVietnamese,
    en: dict.controls.switchToEnglish,
  };

  return (
    <div
      role="radiogroup"
      aria-label={dict.controls.languageLabel}
      // A sunken track with a raised thumb, rather than a bordered box with a
      // solid-accent segment. The old treatment put a filled accent block in
      // the header at every moment — the loudest thing in a bar whose job is
      // to be quiet — and read as a button someone had left pressed. This
      // reads as a control: the track recedes, the active segment sits on the
      // page's own surface colour and carries the accent in its TEXT.
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md bg-wash-sunken p-0.5",
        "ring-1 ring-inset ring-border/70",
        className,
      )}
    >
      {LOCALES.map((locale) => {
        const active = locale === current;
        return (
          <button
            key={locale}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={accessibleName[locale]}
            title={LOCALE_FULL_LABEL[locale]}
            // Re-selecting the current locale would reload for no reason.
            onClick={() => (active ? undefined : setLocaleCookie(locale))}
            className={cn(
              // `font-semibold` on BOTH states, and a fixed min-width: the
              // control must not resize when the active segment changes, or
              // the whole header shifts on every language switch.
              "min-w-[2.25rem] rounded-[5px] px-2 py-1 text-[11px] font-semibold tracking-[0.08em]",
              "transition-[background-color,color,box-shadow] duration-[var(--motion-base)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-canvas",
              active
                ? "bg-surface text-accent shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                : "text-foreground-subtle hover:text-foreground",
            )}
          >
            {LOCALE_LABEL[locale]}
          </button>
        );
      })}
    </div>
  );
}

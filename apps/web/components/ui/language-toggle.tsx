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
      className={cn("inline-flex items-center rounded-sm border border-border p-0.5", className)}
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
              "rounded-[3px] px-2 py-1 text-[11px] font-semibold tracking-[0.08em]",
              "transition-colors duration-[var(--motion-base)]",
              active
                ? "bg-accent text-background"
                : "text-foreground-muted hover:bg-wash-hover hover:text-foreground",
            )}
          >
            {LOCALE_LABEL[locale]}
          </button>
        );
      })}
    </div>
  );
}

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/layout/page-hero";
import { getI18n } from "@/lib/i18n/server";

/**
 * Quiet, atmospheric opening. Deliberately carries no telemetry, no station
 * cards, no map — the network state has its own chapter below, and putting it
 * here was what made an earlier homepage read as a dashboard landing page
 * rather than an introduction to a place.
 *
 * Structure comes from the shared `PageHero`, so this page and the other
 * three public routes share one hero grammar. Home takes the `display` tier:
 * it is the only route allowed to be cinematic.
 *
 * Home is also the only route that justifies two actions — a reader arriving
 * here has not chosen between "show me the data" and "tell me about this"
 * yet. Every other page passes fewer, or none. The second action used to
 * navigate to /about; that page was merged into this one, so it now scrolls
 * to the story rather than leaving.
 *
 * A Server Component, so both language versions are resolved before anything
 * reaches the browser — the hero never flashes the wrong language.
 */
export async function Hero() {
  const { dict } = await getI18n();

  return (
    <PageHero
      scale="display"
      eyebrow={dict.home.eyebrow}
      title={dict.home.title}
      subtitle={dict.home.subtitle}
      // ONE action, not two.
      //
      // The secondary "Về dự án" button scrolled to the chapter immediately
      // below the fold — an action the reader already has by scrolling, which
      // is what made it worth removing rather than restyling. A single
      // primary CTA also lets the opening scene stay a scene: two buttons
      // side by side under a cinematic headline read as a product landing
      // page, which is the thing this hero is deliberately not.
      actions={
        <Button asChild size="lg" className="gap-2">
          <Link href="/dashboard">
            {dict.home.ctaPrimary}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </Button>
      }
    />
  );
}

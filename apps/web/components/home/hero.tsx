import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Quiet, atmospheric opening. Deliberately carries no telemetry, no station
 * cards, no map — the network state has its own chapter below, and putting
 * it here was what made the previous homepage read as a dashboard landing
 * page rather than an introduction to a place.
 *
 * The background is the CSS dot field (globals.css `.horizon-dotfield`);
 * no image is required for this to look finished, which is why
 * public/images/hero/ ships empty rather than with a stand-in photograph.
 */
export function Hero() {
  return (
    // No `.full-bleed` here: the dot field bleeds via its own pseudo-element
    // (globals.css), so the hero stays in normal flow and its headline lands
    // on the same left edge as every other section.
    <section className="horizon-dotfield">
      {/* No measure of its own — `main` already supplies the shared gutter,
          and nesting `.h-wide` here would double it. */}
      <div className="pb-24 pt-16 md:pb-36 md:pt-28">
        {/* Widens a step at 2xl so the headline grows into a 1920 viewport
            instead of hugging the left edge of a mostly-empty band — the dot
            field carries the rest of the width. */}
        <div className="animate-entrance max-w-3xl space-y-7 2xl:max-w-4xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">
            HORIZON · Cồn Hô, Vĩnh Long
          </p>

          <h1 className="text-[length:var(--text-title-display)] font-semibold leading-[1.08] tracking-tight">
            Một cù lao giữa sông, và những thay đổi đang diễn ra mỗi ngày.
          </h1>

          <p className="max-w-xl text-lg leading-relaxed text-muted">
            HORIZON ghi lại nước, đất và không khí quanh Cồn Hô qua ba điểm quan trắc, và trình bày đúng những gì đo
            được.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild size="lg" className="gap-2">
              <Link href="/dashboard">
                Xem mạng lưới quan trắc
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/about">Về dự án</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

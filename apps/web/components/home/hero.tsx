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
    <section className="horizon-dotfield full-bleed">
      <div className="mx-auto max-w-[var(--width-content-wide)] px-4 pb-24 pt-16 md:pb-36 md:pt-28">
        {/* Widens a step at 2xl so the headline grows into a 1920 viewport
            instead of hugging the left edge of a mostly-empty band — the dot
            field carries the rest of the width. */}
        <div className="animate-entrance max-w-3xl space-y-7 2xl:max-w-4xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">
            HORIZON · Cồn Hô, Vĩnh Long
          </p>

          <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight md:text-6xl lg:text-7xl 2xl:text-[5.25rem]">
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

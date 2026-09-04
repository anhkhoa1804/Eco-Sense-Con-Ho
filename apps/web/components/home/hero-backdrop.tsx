import Image from "next/image";

/**
 * The Home hero's photographic canvas — the islet seen from the river.
 *
 * FULL-BLEED, AND IT STARTS AT PIXEL ZERO. The previous version sat inside
 * the hero section only, so the page opened on a pale strip of page
 * background with the header floating in it, and the image began somewhere
 * below that. Read as a composition it looked like a banner pasted into a
 * document rather than an opening scene. This layer now runs from the very
 * top of the document — the header sits ON it, not above it — and covers the
 * whole first viewport.
 *
 * NO PARALLAX. An earlier pass drove this from a scroll listener. It has been
 * removed outright, along with the `--parallax` variable and the component
 * that published it: the effect was repeatedly reported as either invisible
 * or wrong, and a static composition with real scale is the stronger answer.
 * Depth here comes from the scrim and the layering, not from movement.
 *
 * WHY THIS IMAGE. It is the owner's own commissioned illustration of Cồn Hô
 * and matches the network illustration further down the page, so the two read
 * as one hand.
 */
export function HeroBackdrop() {
  return (
    <div className="hero-canvas" aria-hidden>
      {/* `object-cover` with a bottom-biased focal point: as the viewport gets
          shorter the crop must keep the waterline and the islet, which is the
          half of the frame that carries the meaning. Cropping from the centre
          would throw the horizon away and leave sky. */}
      <Image
        src="/assets/hero/hero.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="hero-canvas__image"
      />
      <div className="hero-canvas__scrim" />
    </div>
  );
}

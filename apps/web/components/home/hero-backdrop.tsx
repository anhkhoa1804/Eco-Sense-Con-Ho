import Image from "next/image";

/**
 * The Home hero's photographic backdrop — the islet seen from the river.
 *
 * WHY THIS EXISTS. Home opened on a gradient. The gradient was tasteful and
 * said nothing: a reader arriving at a project about one specific islet in
 * the Mekong saw a colour wash that could have introduced any product. The
 * page is about a PLACE, so the first thing on it should be that place.
 *
 * WHY THIS IMAGE. It is the owner's own commissioned illustration, and it
 * matches the station-map illustration further down the page, so the two read
 * as one hand. Everything else supplied in `public/assets/` is either a
 * watermarked press photograph (Tiền Phong, Fonline) that the project has no
 * licence to publish, or an iPhone HEIC of components still in their
 * packaging. This is the only asset that is both usable and true.
 *
 * WHY IT IS ALLOWED TO BE QUIET. The scrim below is heavy on purpose. The
 * brief is explicit that typography stays dominant, and an illustration this
 * detailed will win against 60px type if it is left at full strength. What
 * the image has to do is establish water, sky and a low green horizon; it
 * does not have to be legible in its detail. Anyone who wants to read the
 * islet properly gets the labelled station map in chapter 04.
 *
 * PARALLAX. This is the layer that finally makes the page's existing parallax
 * system perceptible. `--parallax` has been driving three atmosphere layers
 * for several passes, but all three are low-contrast gradients — motion you
 * cannot see is motion that may as well not run. An image with a hard horizon
 * line and distinct silhouettes moving at 0.22× against content moving at 1×
 * is legible immediately, which is the whole point. Reduced-motion opts out
 * in CSS, alongside every other layer.
 */
export function HeroBackdrop() {
  return (
    // Positioning lives entirely in `.hero-backdrop` rather than in utilities
    // plus `.full-bleed`: that helper sets `position: relative`, which fights
    // the absolute placement this needs, and the two would resolve by
    // stylesheet order rather than by intent.
    <div className="hero-backdrop">
      {/* `object-bottom` keeps the islet and its waterline in frame as the
          box gets shorter — cropping a landscape from the centre would throw
          away the horizon, which is the only part that has to survive. */}
      <div className="hero-backdrop__plate absolute inset-0">
        <Image
          src="/assets/hero/hero.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-bottom"
        />
      </div>

      {/* Two scrims, not one. The vertical pass protects the type column; the
          bottom pass fades the illustration into the page background so the
          hero ends without a seam — the horizontal edge an image sitting in a
          box would otherwise draw across the full width of the page. */}
      <div className="hero-backdrop__scrim absolute inset-0" />
    </div>
  );
}

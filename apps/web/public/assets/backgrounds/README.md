# Hero backgrounds — reserved, deliberately empty

This folder is the drop point for a future phase's per-route hero
illustrations. **It ships empty on purpose.** Nothing here is a placeholder to
be filled with a stock photograph or a generated image: HORIZON does not
publish imagery that implies fieldwork it has not done, and an invented
"Cồn Hô at dawn" behind the homepage title would be exactly that claim.

## The contract that already exists

`components/layout/page-hero.tsx` accepts a `backdrop` slot. It renders behind
the hero copy at `z-0`, with the eyebrow / title / subtitle at `z-10`, so an
image can be introduced **without touching any page's markup or the hero's
layout**:

```tsx
<PageHero
  eyebrow={dict.about.eyebrow}
  title={dict.about.title}
  subtitle={dict.about.subtitle}
  backdrop={<HeroBackdrop src="/assets/backgrounds/about.webp" />}
/>
```

Expected filenames, one per public route:

```
home.webp
about.webp
monitoring.webp
report.webp
```

## What that phase still has to solve

The slot is the easy half. Before an image goes in, three things need
deciding, and none of them are layout problems:

1. **Provenance.** A photograph of Cồn Hô needs to be a photograph of Cồn Hô,
   credited, with a capture date — the same standard every number on the
   observatory canvas is held to.
2. **Contrast.** The hero title must keep its ratio against whatever sits
   behind it, in both themes. That likely means a scrim token rather than
   baking a gradient into the asset.
3. **Weight.** These are above-the-fold images on a site read over mobile
   connections in the Mekong Delta. Budget them before choosing them.

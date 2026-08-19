# Image assets

## Status vocabulary

Every asset in this tree is one of:

| status        | meaning                                                        |
| ------------- | -------------------------------------------------------------- |
| `placeholder` | Abstract stand-in. Not a photograph. Safe to delete/replace.     |
| `verified`    | Real HORIZON project imagery, cleared for public use.            |

**Nothing here may be presented as HORIZON fieldwork unless it is `verified`.**

## Current contents

### `hero/`

Currently empty by design. The homepage hero uses a CSS dot-field atmosphere
(see `.horizon-dotfield` in `app/globals.css`) rather than a photograph, so no
hero image is required for the page to look finished.

To introduce a real hero photograph later: drop a file in here and reference it
from the hero section in `components/home/hero.tsx`. The dot-field layer is
designed to sit behind an image without changes.

### `gallery/`

`gallery-placeholder-01.svg` … `gallery-placeholder-05.svg` — **status:
`placeholder`.**

These are deliberately abstract SVG compositions (dot grids, contour lines,
schematic shapes) in the HORIZON palette. They are *not* photographs and each
carries a visible `PLACEHOLDER · NN` label so a reviewer can never mistake one
for documentation of a real site visit.

They are referenced as `cover:` values by the Field Notes posts in
`apps/web/content/posts/`.

To replace one: drop a real image into this folder and update that post's
`cover:` frontmatter field. No code change needed.

### `con-ho-station-map.png`

Pre-existing illustrative station map used by the About page.

## Rule

Do not add downloaded/stock/external photographs to this tree and reference
them as project imagery. If external material is ever needed for visual
reference, keep the source attribution with it and label it clearly as
reference material, not HORIZON documentation.

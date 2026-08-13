# HORIZON Redesign Specification

**Status: the primary source of truth for the frontend redesign.** Supersedes
this document's own earlier draft, which was written before the Phase D
implementation pass and is now factually wrong in several places (it
described the homepage map as "an abstract gradient illustration" and
elsewhere as "a real photo-based map image" — it is neither; it's a real,
interactive Leaflet map today). This version was written by reading the
current source directly — every claim below cites the file it comes from.

Nothing in this document has been implemented yet **for the items in
§12's phased plan**. Where a principle below is already true in the live
product, it says so explicitly, so this document doesn't get stale the
same way its predecessor did.

---

## 1. Design objective

Make HORIZON's frontend visually coherent with itself. The backend/data
layer is honest and correct (no fabricated data anywhere, verified across
three prior phases). The problem is not "make it modern" — it's that two
incompatible visual languages currently coexist in one product: a
deliberately-redesigned "no boxes, rule-separated" public surface, and an
untouched "everything in a bordered card, sometimes nested" admin surface.
Closing that gap, plus adding the two structural tokens that were never
built (spacing scale, admin shell), is most of the actual work.

## 2. Product character

A calm instrument reporting on a real river system in Cồn Hô, Trà Vinh —
not a startup dashboard, not an eco-NGO microsite. Quiet, precise,
technical, trustworthy. The existing color-token reasoning already nails
this (`globals.css:12-14`: brand blue is deliberately *not* green, because
green is reserved for the "healthy" status meaning — using it for both
would read as generic eco-branding). Extend that same discipline
everywhere else.

## 3. Visual principles

1. **Provenance is part of the data, not a UI nicety.** A number's age and
   trust level are as important as the number itself — this is already the
   product's stated philosophy (`docs/ARCHITECTURE.md`'s freshness/quality
   two-axis model) and is already implemented in `StatusIndicator`/
   `QualityIndicator`. Every new surface must use it, not reinvent it.
2. **The map and the real numbers are the only decoration.** No abstract
   illustration competes with them — already true (`StationNetworkMap` is
   real, `page.tsx`/`dashboard/page.tsx` both render it against live
   coordinates). Keep this discipline; do not add decorative panels.
3. **One container language, applied everywhere, including admin.** Public
   pages already prove the "borders + rules, not boxes" pattern works
   (`station-detail.tsx`'s own comment: "Bare metric grid... matches the
   dashboard's global-status pattern"). Admin must adopt the same language,
   not a parallel one.
4. **Two densities, one token set.** Public stays large-type, generous,
   one-idea-at-a-time. Admin gets tighter spacing and tabular data — same
   colors, same radius scale, same motion, different density, never a
   different visual grammar.
5. **Restraint over decoration.** Borders as the default separator, not
   shadows. Shadow reserved for true overlays (dropdowns, modals) sitting
   above the page's own stacking context — this is already `globals.css`'s
   stated intent (`--shadow-xs/sm` used for "subtle borders over dramatic
   shadows") but is inconsistently followed (see §6).

## 4. Typography hierarchy

**Currently missing entirely as a token — this is a real gap, not a
polish item.** `globals.css`'s `@theme` block has color, radius, shadow,
motion, and z-index tokens but zero font-size tokens. Every heading size
today is a hand-picked Tailwind class per call site: homepage h2 is
`text-4xl md:text-6xl` (`page.tsx:165`), about page's equivalent is
`text-3xl md:text-4xl` (`about/page.tsx:55`), dashboard's h1 is `text-2xl`
(`dashboard/page.tsx:113`), admin's h1 is `text-3xl` (`admin/page.tsx:438`).
None of these are wrong in isolation; there's just no rule connecting them.

**Target scale** (add as CSS custom properties in `globals.css`'s `@theme`
block, next to the existing radius/shadow tokens):

| Token | Size | Usage |
|---|---|---|
| `--text-eyebrow` | 11px, uppercase, `tracking-[0.2em]+` | Section/page eyebrows — already the de facto pattern everywhere, just not tokenized |
| `--text-display` | 40–56px (`text-4xl md:text-6xl`) | Homepage/about hero only — marketing-register pages |
| `--text-h1` | 24–28px (`text-2xl md:text-3xl`) | Tool-register page titles (dashboard, station detail, admin) |
| `--text-h2` | 20–22px | Section titles (what `SectionHeader` already renders) |
| `--text-body` | 16px, line-height 1.6+ | Public body copy — outdoor mobile reading |
| `--text-body-dense` | 14px | Admin body/table copy |
| `--text-caption` | 12–13px | Metadata, timestamps |

**Rule:** the homepage and `/about` are the only two pages allowed to use
`--text-display` — everything else (including their own non-hero sections)
uses `--text-h1`/`--text-h2`. This single rule would have prevented the
current drift.

## 5. Color philosophy

**Already correct — do not change the palette.** Five semantic states
(`healthy/watch/risk/offline/fault`), brand blue deliberately separated
from the "healthy" green, data-viz colors (`salinity`, `water-level`)
separated from status colors. Verified against `globals.css` directly.

**One real bug to fix:** `Badge`'s status variants are being reused in
`admin/page.tsx` for meanings that have nothing to do with environmental
status — `variant="healthy"` labels an email as "sourced from `.env`"
(`admin/page.tsx:594`), `variant="watch"` labels a report as "not yet
synced to Supabase" (`:481`). This quietly breaks the rule "green always
means environmentally healthy" that the rest of the product depends on.
**Fix:** these need a separate, neutral tag treatment — not a `Badge`
status color at all. See §10.

## 6. Surface philosophy

**The core inconsistency this redesign must resolve.** Three different
container treatments currently exist for conceptually similar "boxed
content":

| Component | Radius | Background | Shadow |
|---|---|---|---|
| `Card` | `rounded-lg` (18px) | `bg-card` | `shadow-xs` |
| `EmptyState` | `rounded-xl` (24px) | `bg-muted/20` | `shadow-xs` |
| `EmptyState`'s icon well | `rounded-2xl` (16px, **off the token scale entirely**) | `bg-background` | none |

**Rule going forward:** `EmptyState` composes `Card` (or a shared base),
not its own bespoke treatment. Nothing renders at `rounded-2xl` — it
doesn't exist on the token scale and never should.

**The bigger issue is structural, not just a radius mismatch:** public
pages deliberately don't use `Card` for data listings (rule-separated rows
instead — correct, keep it). Admin uses `Card` for *everything*, including
nesting a second bordered box inside a `CardContent` in three separate
places (`admin/page.tsx:588`, `:650`, and the notification dropdown's
report items at `:470`). **Rule:** a `Card` never contains another
bordered/shadowed container as a direct child. If a section needs internal
grouping, use spacing and a rule (border-top), not a nested box.

## 7. Spacing philosophy

**Currently unenforced — the second structural gap.** No spacing tokens
exist; every page picks `mt-20`, `gap-12`, `space-y-8`, `space-y-10`,
`space-y-6` independently. They look similar by convention, not by system.

**Target scale**, matching the existing radius/shadow token pattern (add
to `globals.css`): `4, 8, 12, 16, 24, 32, 48, 64, 96px`. Public
marketing-register pages (`/`, `/about`) default to the top of the range
between major sections (currently `mt-20` = 80px — close enough, round to
96px or 64px, pick one and use it everywhere instead of `mt-20`
specifically). Tool-register pages (`/dashboard`, `/s/[id]`, `/admin`)
default to the middle (24–32px between sections). Nothing outside this
scale, including inside admin's forms.

## 8. Layout/grid philosophy

Already reasonably consistent and worth keeping: `max-w-7xl` for public
pages via `PublicShell`, asymmetric hero grids (`lg:grid-cols-[1.05fr_0.95fr]`)
repeated across `/`, `/about` — keep this pattern, it's a real, deliberate
rhythm, not an accident. Admin currently uses a completely different,
narrower `max-w-5xl` with no shell — this either needs to adopt
`PublicShell`'s grid logic via a new `AdminShell`, or explicitly justify
staying narrower (dense operational data can reasonably want less line
length). Recommendation: give admin its own `max-w-6xl` via `AdminShell`,
not `PublicShell` verbatim — it's a genuinely different audience, per
`docs/PRODUCT_PHILOSOPHY.md`, but it should still be *a* shell, not zero
shell.

## 9. Navigation philosophy

**Public nav is correct — do not restructure.** `Trang chủ / Quan trắc /
Báo cáo` plus a separate admin affordance (`public-shell.tsx`) maps
cleanly to the actual reachable surfaces; desktop-horizontal /
mobile-bottom-tab split is already implemented and accessible. Resist
adding new top-level items (e.g., a separate "Alerts" nav) — alerts
already surface in context (dashboard, station detail), which matches how
someone actually thinks about this product ("is my station okay," not
"show me an alerts inbox").

**Admin has no navigation at all** — one long scrolling page. At its
current size (station overview, allowlist, one config panel, one report
panel) this is arguably still fine information-density-wise; it does not
need a sidebar or multi-route split. It does need `AdminShell` as a
*visual* frame (header/wordmark parity with public, consistent max-width)
even without adding navigation items.

## 10. Component philosophy

**Extend the existing primitives; do not replace them.** `Card`, `Badge`,
`Metric`, `SectionHeader`, `StatusIndicator`/`QualityIndicator`,
`EmptyState`, `Button`, `Input`, `Label`, `Textarea`, `Skeleton` are all
structurally sound — see the inventory in §11 for what changes and what
doesn't.

**New primitives actually needed** (small list, each justified by a
concrete repeated pattern found this audit, not speculative):

- **`Wordmark`** — the "Horizon" eyebrow + title pattern, currently hand-
  typed identically in `public-shell.tsx:37-38` and `admin/login/page.tsx:28-29`.
  One component, two call sites fixed.
- **`Tag`** — a neutral, non-status label for things like "Gốc"/"Database"
  in the admin allowlist (`admin/page.tsx:594,596`) and "Lưu tạm" for
  demo-mode reports (`:481`) — these are not environmental-status badges
  and must stop borrowing `Badge`'s status color vocabulary.
- **`Alert`** — a single banner component for error/warning inline
  messages, replacing three hand-typed near-duplicates
  (`admin/page.tsx:514`, `:520`, `report-form.tsx:241`).
- **`AdminShell`** — header (using `Wordmark`), consistent max-width,
  sign-out affordance — the one real structural gap, see §8/§9.

**Not needed, despite being proposed in the earlier draft of this
document:** `DataTable` (no admin table-shaped data exists yet — build
when the device/ingestion-health view is actually scoped, not before),
`ProvenanceIndicator` (already redundant with the existing
`StatusIndicator compact` pattern — don't build a second one), dark mode
(no evidence of demand; the existing light-only surface is a deliberate,
still-valid call per `docs/VISUAL_REFERENCES.md`'s explicit rejection of a
Linear-style dark-first aesthetic).

## 11. Component inventory

| Component | File | Verdict | Why |
|---|---|---|---|
| `Card` | `ui/card.tsx` | **KEEP**, tighten contract | Sound primitive; needs the "never nest a box inside it" rule enforced (§6) |
| `Badge` | `ui/badge.tsx` | **KEEP**, narrow scope | Status-only going forward; stop admin's non-status reuse (§5) — create `Tag` for that instead |
| `Metric` | `ui/metric.tsx` | **KEEP as-is** | Already the right shape — value/unit/label/provenance in one place, actively used correctly on dashboard and station detail |
| `SectionHeader` | `ui/section-header.tsx` | **KEEP, adopt more widely** | Only 2 of homepage's 6 sections use it; the rest hand-type the same eyebrow+title markup inline (`page.tsx:233-234`, `:41`) — route everything through it |
| `StatusIndicator` / `QualityIndicator` | `ui/status-indicator.tsx` | **KEEP as-is** | Correct two-axis model, already documented in `docs/TELEMETRY_STATE_MODEL.md`, actively used correctly |
| `EmptyState` | `ui/empty-state.tsx` | **REDESIGN** | Compose `Card`, drop the off-scale `rounded-2xl` icon well (§6) |
| `Button` | `ui/button.tsx` | **KEEP**, enforce | Sound `cva` implementation; `report-form.tsx`'s hand-typed `rounded-full` overrides need to either become a real documented `pill` variant or be removed in favor of the default |
| `StationNetworkMap` | `dashboard/station-network-map.tsx` | **KEEP as-is** | Real Leaflet+CartoDB, honest empty state, genuinely the strongest part of the current product |
| Admin's `<details>/<summary>` notification dropdown | `admin/page.tsx:442-508` | **SPLIT out into `Popover`-style primitive** | One-off today; worth a shared component only if a second use case appears — otherwise leave as-is, don't build speculative infrastructure |
| Hand-typed wordmark (×2) | `public-shell.tsx:37-38`, `admin/login/page.tsx:28-29` | **MERGE → `Wordmark`** | Exact duplicate markup, two files |
| Hand-typed alert banners (×3) | `admin/page.tsx:514,520`, `report-form.tsx:241` | **MERGE → `Alert`** | Near-duplicate markup |
| Icon-in-circle pattern (×3 sizes) | `page.tsx:241`, `about/page.tsx:122`, `empty-state.tsx:12` | **CREATE `IconTile`** or standardize to one size | Currently 12/10/12px circles with two different fill treatments and no shared source |
| `logo.png` | repo root | **CLASSIFY, don't touch source yet** | Orphaned, unreferenced. Placement/wiring decision belongs to whoever owns the actual brand asset — flagged, not resolved, in this audit-only phase |

## 12. Data visualization philosophy

Keep the existing `SalinityChart` house style as-is — threshold reference
lines drawn directly on the trend area, not a separate legend (confirmed
this is already implemented and is genuinely good). Apply the identical
pattern if/when a soil EC chart is ever built (blocked on the
`soil_readings` UI-wiring gap already tracked in
`docs/IMPLEMENTATION_ROADMAP.md`, out of scope here).

## 13. Map philosophy

Already correct — real coordinates, real Leaflet/CartoDB tiles, honest
empty state when `stations.length === 0`. No change needed. The one open
question is product-level, not visual: `/` and `/dashboard` currently
render the *exact same map component* with no differentiated framing
(`page.tsx:137` vs `dashboard/page.tsx:34`) — this is an information-
architecture decision (what does the homepage's map add that the
dashboard's doesn't?), not a visual redesign task. Recommend resolving it
in Phase R4 (§16) by making the homepage's map a smaller, non-interactive
preview that leads into the real dashboard map, rather than a second full
instance of the same component.

## 14. Empty / error / loading states

**Already systematically correct at the data-honesty level** — verified
across three prior phases, no fabricated data found anywhere. What's
inconsistent is purely the *container* (§6's `EmptyState` fix) — the
underlying logic (never show 0 for "no data," always say "Chưa có dữ
liệu") is sound and must not be touched.

## 15. Mobile philosophy

Keep the existing discipline — mobile-first from 320px, bottom-tab nav,
44px touch targets, all confirmed still correctly implemented. No
regression found this audit.

## 16. Motion philosophy

Keep existing tokens (`--motion-fast/base/medium/slow`, `--ease-standard`)
and the `prefers-reduced-motion` handling in `globals.css:87-96` — both
correct and already in place. No new motion work needed for this pass;
motion polish is explicitly the *last* phase (R10, §17), not something to
front-load.

## 17. Accessibility requirements

Carry forward what's already correct: real `aria-label`s, `aria-current`,
focus-visible rings (`globals.css:119-122`), `role="radiogroup"`/
`aria-checked` on the report form's category picker. No new requirement
identified this pass beyond what `docs/ACCESSIBILITY_PERFORMANCE.md`
already states — this redesign is visual/structural, not an accessibility
remediation.

## 18. Explicit anti-patterns

- **Do not** put a bordered/shadowed box inside another bordered/shadowed
  box (§6) — this is the single most repeated concrete defect found.
- **Do not** invent a new radius value. If none of `xs/sm/md/lg/xl`
  (6/10/14/18/24px) fits, that's a signal to reconsider the component, not
  to add a sixth token.
- **Do not** reuse `Badge`'s status colors for non-status labels (§5).
- **Do not** add a second visual language for admin "because it's
  different" — density can differ, the container/type/spacing system must
  not (§3.4).
- **Do not** build `DataTable`, dark mode, or `ProvenanceIndicator` — all
  three were proposed in the previous draft of this document and are not
  justified by any current, real requirement (§10).
- **Do not** touch the HORIZON wordmark/logo's actual content, color, or
  meaning — only its *packaging* (one `Wordmark` component instead of two
  hand-typed copies) is in scope.

## 19. Page-by-page design goals

### `/` — Homepage
**Objective:** orient a first-time visitor in one screen; prove the
product is real via live numbers, not marketing copy. **Primary action:**
go to `/dashboard`. **Focal point:** the live ribbon stats + map preview,
not the hero headline. **Fix:** route all 6 sections through
`SectionHeader`; shrink the map preview so it's visually distinct from
the dashboard's full map (§13); apply the type scale so the hero uses
`--text-display` and nothing else on the page does.

```
┌────────────────────────────────────────────────┐
│ NAV (PublicShell)                               │
├────────────────────────┬────────────────────────┤
│ Badges + eyebrow        │                        │
│ --text-display headline │   Compact map preview  │
│ Supporting copy          │   (not full dashboard  │
│ CTA buttons              │    map — see §13)      │
│ Live ribbon stats (real) │                        │
├────────────────────────┴────────────────────────┤
│ SectionHeader: "Ba điểm chạm"                    │
│ 3-column focus items (Trạm 1 / Trạm 2 / Gateway) │
├───────────────────────────────────────────────────┤
│ Story blocks (alternating, --spacing scale between)│
├───────────────────────────────────────────────────┤
│ 3-outcome grid                                     │
├───────────────────────────────────────────────────┤
│ SectionHeader: final CTA                           │
└───────────────────────────────────────────────────┘
```
Mobile: single column, map preview moves below the fold (after ribbon
stats, before "Ba điểm chạm").

### `/dashboard` — Observatory
**Objective:** answer "what's happening right now, where, is anything
wrong" in one screen. **Primary action:** click into the highest-priority
station. **Focal point:** the priority-sorted station list — already
correctly sorted (`stationPriority()`), keep the logic, this is a visual
pass only.

```
┌──────────────────────────────────────────────────┐
│ NAV                                                │
├──────────────────────────────────────────────────┤
│ H1 (--text-h1) + report/about shortcuts            │
├──────────────────────────────────────────────────┤
│ Global status strip (4 Metrics, border-y)          │
├──────────────────────────────────────────────────┤
│ Full station network map                           │
├────────────────────────┬───────────────────────────┤
│ Priority-sorted stations│ Alerts (EmptyState if none)│
├────────────────────────┴───────────────────────────┤
│ Salinity trend chart    │ 24h delta summary          │
├──────────────────────────────────────────────────┤
│ Daily comparison chart                              │
└──────────────────────────────────────────────────┘
```
Mobile: same order, map becomes shorter/scrollable, station list and
alerts stack vertically instead of 2-column.

### `/s/[stationId]` — Station detail
**Objective:** the actual QR-scan destination — answer "is this specific
station okay" instantly. **This page's IA is already correct** per prior
audit — the redesign work here is purely visual (§6's `EmptyState` fix if
it ever renders one; otherwise no structural change).

```
┌──────────────────────────────────────────────────┐
│ NAV                                                │
├──────────────────────────────────────────────────┤
│ Location eyebrow + station name + intro            │
├──────────────────────────────────────────────────┤
│ 3-axis status row: operational | freshness | quality│
├──────────────────────────────────────────────────┤
│ Metric grid (station-kind-specific, 4 values)      │
├────────────────────────┬───────────────────────────┤
│ Live trend chart         │ Recommendation + raw stats│
├──────────────────────────────────────────────────┤
│ Other stations (rule list)                         │
├──────────────────────────────────────────────────┤
│ Back to map / Report near this station              │
└──────────────────────────────────────────────────┘
```
Already mobile-correct (single column, all sections stack).

### `/report` — Field report
**Objective:** low-friction submission, works without GPS. **Fix:**
replace hand-typed `rounded-full` overrides with the standard `Button`
(or promote `pill` to a real named variant if the product genuinely wants
it elsewhere too — decide, don't leave it as one page's private choice).

```
┌──────────────────────────────────────────────────┐
│ NAV                                                │
├──────────────────────────────────────────────────┤
│ Eyebrow + H1 + supporting copy                     │
├──────────────────────────────────────────────────┤
│ Category picker (radiogroup pills — keep shape,    │
│   fix via a named variant not a hand override)      │
├──────────────────────────────────────────────────┤
│ Location (GPS button + station-id fallback input)  │
├──────────────────────────────────────────────────┤
│ Description textarea                                │
├──────────────────────────────────────────────────┤
│ Photo-not-supported notice (Alert, not hand-typed)  │
├──────────────────────────────────────────────────┤
│ Sticky submit button (mobile) / static (desktop)    │
└──────────────────────────────────────────────────┘
```

### `/about` — Story
**Objective:** narrative context for press/researchers/curious visitors.
**Fix:** de-duplicate the icon-in-circle pattern (§11's `IconTile`), align
heading sizes to the type scale (currently mixes `text-3xl`, `text-4xl`,
`text-2xl` across its own sections with no rule).

### `/admin/login` — Gate
**Objective:** minimal, fast. **Fix:** use `Wordmark` instead of the
hand-typed duplicate (§10).

### `/admin` — Operations console
**Objective:** the operator's entire toolkit on one screen — station
overview, runtime config, allowlist, report triage. **This page needs the
most structural work**: wrap in `AdminShell` (§8/§9), remove nested boxes
(§6), replace `Badge` misuse with `Tag` (§5), replace the three hand-typed
warning/error banners with `Alert` (§10).

```
┌──────────────────────────────────────────────────┐
│ AdminShell header (Wordmark + report bell + sign-out)│
├──────────────────────────────────────────────────┤
│ Error/demo-mode Alert (if applicable)              │
├────────────────────────┬───────────────────────────┤
│ Station overview Metric │ Public shortcuts           │
├──────────────────────────────────────────────────┤
│ Allowlist management     │ Data retention notes       │
├──────────────────────────────────────────────────┤
│ Sleep-mode config (3 station forms, no nested boxes)│
├──────────────────────────────────────────────────┤
│ Station list (rule-separated, matches public style) │
└──────────────────────────────────────────────────┘
```
De-emphasize on mobile: retention notes card can collapse/move last;
everything else must remain usable at 375px (operator may check from a
phone in the field).

## 20. Definition of "done"

A page is done when: it uses only tokens from §4/§7's type/spacing scales
(no bespoke `text-*`/`mt-*` values), every container follows §6's rule
(no nested boxes), every status color traces back to `Badge`'s five real
states (nothing borrowed for non-status meaning), and it passes the
existing `docs/TECHNICAL_QA_CHECKLIST.md`/`docs/UI_AUDIT_CHECKLIST.md`
gates unchanged.

## 21. What HORIZON should NOT look like

Not a dark, futuristic control room. Not glassmorphism. Not gradient-
heavy. Not a card for every single number (the exact pattern already
correctly eliminated from public pages — don't let it creep back via
admin's unfinished state). Not a generic eco-NGO site (green-everything —
already correctly avoided at the token level, see §5). Not decorative
animation — motion only clarifies a state change, never decorates.

---

# 22. Redesign Execution Plan

Each phase lists files likely affected, dependencies, risk, acceptance
criteria, and what must NOT change.

## Phase R1 — Tokens
**Files:** `apps/web/app/globals.css` only.
**Adds:** type scale (§4), spacing scale (§7).
**Dependencies:** none — this is the foundation everything else builds on.
**Risk:** low (additive, no existing class removed yet).
**Acceptance:** new CSS custom properties exist; zero visual change yet
(nothing consumes them until R2+).
**Do NOT:** touch color/radius/shadow/motion tokens — those are correct.

## Phase R2 — Shell + navigation
**Files:** new `apps/web/components/layout/admin-shell.tsx`, new
`apps/web/components/ui/wordmark.tsx`; edits to `public-shell.tsx` and
`admin/login/page.tsx` to consume `Wordmark`.
**Dependencies:** R1 (uses new type tokens for the wordmark).
**Risk:** low — additive component, two small call-site swaps.
**Acceptance:** `Wordmark` renders identically to the current hand-typed
markup in both places; `AdminShell` exists but `admin/page.tsx` doesn't
consume it yet (that's R8).
**Do NOT:** change the public nav structure (§9) or the wordmark's actual
text/branding.

## Phase R3 — Primitives
**Files:** `ui/empty-state.tsx` (compose `Card`, fix icon well), new
`ui/tag.tsx`, new `ui/alert.tsx`, new `ui/icon-tile.tsx`.
**Dependencies:** R1.
**Risk:** low-medium — `EmptyState` is used on `/dashboard` (2 call sites)
and possibly elsewhere; verify all call sites after the change.
**Acceptance:** `EmptyState` visually matches `Card`'s radius/shadow;
`Tag`/`Alert`/`IconTile` exist and are unit-testable in isolation (no
consumers wired yet).
**Do NOT:** change `Metric`, `SectionHeader`, `StatusIndicator` — they're
already correct.

## Phase R4 — Homepage
**Files:** `apps/web/app/page.tsx`.
**Dependencies:** R1, R2 (Wordmark not needed here, but type/spacing
tokens are), R3 (SectionHeader adoption).
**Risk:** medium — highest-traffic page, most sections to touch.
**Acceptance:** all 6 sections use `SectionHeader`; map preview is
visually distinct from `/dashboard`'s (§13); only the hero uses
`--text-display`.
**Do NOT:** change the live-data logic (`LiveSummary`, `NetworkPreview`)
— this is a visual-only pass.

## Phase R5 — Dashboard
**Files:** `apps/web/app/dashboard/page.tsx`.
**Dependencies:** R1, R3.
**Risk:** low — structure is already close to correct, mostly a token-
consistency pass.
**Acceptance:** no bespoke spacing/type values remain; `EmptyState` uses
the R3 version.
**Do NOT:** change `stationPriority()`'s sort logic — verified correct.

## Phase R6 — Station detail
**Files:** `apps/web/components/stations/station-detail.tsx`.
**Dependencies:** R1, R3.
**Risk:** low — smallest gap of any page.
**Acceptance:** token-consistency pass only; IA unchanged.
**Do NOT:** change `stationProfiles` or the fallback logic — that's a
backend/IA decision, not a design one (flagged in Step 5, not resolved
here).

## Phase R7 — Report / About
**Files:** `apps/web/components/report/report-form.tsx`,
`apps/web/app/about/page.tsx`.
**Dependencies:** R1, R3 (`Alert`, `IconTile`).
**Risk:** low.
**Acceptance:** report form's pill buttons are either a named `Button`
variant or reverted to default; about page's icon-in-circle uses
`IconTile`; both pages' headings follow the type scale.
**Do NOT:** change the report submission logic or the geolocation flow.

## Phase R8 — Admin
**Files:** `apps/web/app/admin/page.tsx`, `apps/web/app/admin/login/page.tsx`.
**Dependencies:** R1, R2 (`AdminShell`, `Wordmark`), R3 (`Tag`, `Alert`).
**Risk:** medium-high — the largest, most-affected single file; touches
every card in the page.
**Acceptance:** page wrapped in `AdminShell`; zero nested boxes remain
(§6); `Badge` used only for actual station status, `Tag` for allowlist
source/report-sync labels; all three inline banners replaced with
`Alert`.
**Do NOT:** change any server action (`updateRuntimeConfig`,
`addAdminEmail`, etc.) or the underlying data logic — visual pass only.

## Phase R9 — Responsive/mobile verification
**Files:** none (verification pass across all pages above).
**Dependencies:** R4–R8 complete.
**Risk:** low.
**Acceptance:** manual check at 375/390/768/1024/1440 per
`docs/TECHNICAL_QA_CHECKLIST.md`'s existing gate; admin specifically
checked at 375px (§19's mobile note).
**Do NOT:** skip admin — it's the page most likely to have been designed
desktop-first historically.

## Phase R10 — Motion/polish
**Files:** touch-ups only, wherever R4–R8 left a rough transition.
**Dependencies:** R4–R9.
**Risk:** low.
**Acceptance:** any new interactive element (e.g., `AdminShell`'s
sign-out, `Alert` dismiss if added) uses existing motion tokens; nothing
new invented.
**Do NOT:** add decorative animation anywhere (§21).

## Phase R11 — Visual QA
**Files:** none.
**Dependencies:** all prior phases.
**Risk:** low.
**Acceptance:** full `docs/UI_AUDIT_CHECKLIST.md` pass; confirm §18's
anti-pattern list has zero violations via a final grep for `rounded-2xl`,
`rounded-full` outside `Button`'s own variant, and hand-typed
`border.*shadow` combinations outside `ui/*`.
**Do NOT:** treat this as a rubber stamp — it's the actual verification
that R1–R10 held.

---

# 23. What this document deliberately does not do

No Tailwind class-by-class migration diff, no Figma files, no logo/brand
redesign (explicitly out of scope — see §18). This is the decision record
the redesign phases execute against, matching how `docs/ARCHITECTURE.md`
governs the backend. Implementation begins at Phase R1, not in this
document.

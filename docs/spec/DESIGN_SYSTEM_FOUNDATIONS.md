# Design system foundations

This document locks the **layout + sizing discipline** for WebUI Next.
It exists to prevent the “random-sized UI” problem: cards, headings, and controls
must feel like they come from one system.

If something needs to look bigger/smaller, it must do so using **approved scale steps**
and **approved component variants**—not ad‑hoc pixels.

Last updated: 2026-02-11

## Goals

- Keep the UI visually calm even when it is information-dense.
- Make information priority obvious **without** arbitrary sizing.
- Ensure screens are predictable across modules (VPS, datasets, DNS, admin).
- Make it easy to implement consistently in Tailwind (tokens + variants).

## Non-goals

- Creating a full-blown design system website.
- Allowing arbitrary per-page custom sizing.

## Core rule: no arbitrary sizes

**Allowed**:
- using Tailwind scale steps (`p-2`, `text-sm`, `h-9`)
- using named component variants (`Button size="sm"`)
- using layout spans (grid `col-span-*`) to express importance

**Not allowed**:
- `w-[137px]`, `text-[15px]`, `h-[73px]` in shared UI
- one-off card paddings or font sizes per screen

If a new size is genuinely needed, it must be introduced as a **token/variant** and
then reused.

## Tokenization and enforcement

To keep the UI consistent and maintainable, sizing and colors are tokenized and enforced.

See:
- `TAILWIND_TOKENIZATION_POLICY.md` (rules + migration strategy)
- `SIZE_TOKENS_AND_VARIANTS.md` (drawer widths, table min-width buckets, console sizing, …)
- `THEME_TOKENS.md` (semantic colors + theme model)

Enforcement:
- `npm run lint:tailwind` (implemented by `scripts/lint-tailwind-tokens.mjs`)

Policy note:
- bracket utilities are only acceptable for **structure** (e.g. `grid-cols-[1fr_auto]`),
  not for numeric sizing like `w-[22rem]`.

## Spacing scale

We use a **4px base grid** and a constrained spacing ladder.

Approved spacing steps (Tailwind values):

- `0` → 0px
- `1` → 4px
- `2` → 8px
- `3` → 12px
- `4` → 16px
- `5` → 20px
- `6` → 24px
- `8` → 32px
- `10` → 40px
- `12` → 48px

Rules:
- default section gap on desktop: `gap-6`
- default section gap on mobile: `gap-4`
- use `gap-2`/`gap-3` for dense inline groups (badges, chips)

## Typography scale

We prefer fewer sizes, used consistently.

Body:
- default: `text-sm` (dense dashboards)
- long-form/help: `text-base`
- table secondary: `text-xs`

Numeric scanability:
- Use **tabular numerals** (`tabular-nums`) for numeric-heavy surfaces:
  - list tables
  - stat card values
  - counts/quotas where columns must visually align

Note:
- Raw list tables that use the `table-list` class also enable tabular numerals via CSS (parity with the `Table` primitive).

Headings:
- Page title: `text-xl` (desktop), `text-lg` (mobile)
- Section title: `text-base` + `font-semibold`
- Subsection title: `text-sm` + `font-medium`

Numeric emphasis (stat cards):
- Featured stat number: `text-3xl` (one per page max)
- Standard stat number: `text-2xl`
- Compact stat number: `text-xl`
- Inline numeric highlight (e.g., “Running 7/8”): `text-lg`

Rules:
- never mix more than **two** numeric emphasis levels in one stat grid
- never use huge headings to compensate for weak layout; fix grouping/order first

## Layout grid and rhythm

### Breakpoints

We use Tailwind breakpoints:
- `md` = 768
- `lg` = 1024
- `xl` = 1280

### Desktop grid

For dashboard-like surfaces, we use a **12-column grid**.

Allowed column spans (to avoid “random” widths):
- 12 (full)
- 6 (half)
- 4 (third)
- 3 (quarter)

Avoid odd spans (5,7,8,10,11) unless there is a strong reason.

### Card height discipline

Stat cards must look like a system.

Rules:
- stat cards in the same row should share the same height (use `min-h-*`)
- use **width** (span) + **typography variant** to express priority, not random heights

Recommended baseline:
- stat card `min-h`: `min-h-24` (96px)

Charts:
- small chart: `h-40` (160px)
- standard chart: `h-60` (240px)
- large chart: `h-80` (320px)

## Controls (buttons, inputs)

We standardize control sizes to keep lists and headers aligned.

Buttons:
- `sm`: `h-8` (32px) – dense tables/toolbars
- `md`: `h-9` (36px) – default desktop
- `lg`: `h-11` (44px) – default mobile touch targets

Inputs/selects follow the same heights.

Icons:
- inline: 16px
- toolbar: 20px
- featured: 24px

## Tables: zebra, state tint, and row navigation

Lists are a core part of vpsAdmin. We standardize list tables so that:
- dense data stays readable (zebra striping)
- non-normal states pop instantly (stopped/disabled/error)
- navigation is efficient (whole row click on desktop)

### Table variants

Use the `Table` primitive:

- `variant="list"` (default): zebra striping + row state tint support
- `variant="plain"`: no list styling (use for key/value grids or form-like tables)

For raw `<table>` markup, add the `table-list` class to opt into list styling.

### Row state tint

Use row variants through the `data-row-variant` attribute:

- `ok`: healthy/completed
- `warn`: stopped/disabled/attention needed
- `danger`: failed/error/suspended
- `muted`: in-progress/busy/locked (non-error)

Example:

```tsx
<tr data-row-variant={item.enabled ? undefined : 'warn'}>
  ...
</tr>
```

### Whole-row navigation

For tables that list objects with a detail page, wrap the row with `TableRowLink`:

```tsx
<TableRowLink
  to={`${basePath}/vps/${vps.id}`}
  variant={vps.is_running ? undefined : 'warn'}
  className="border-b border-border/60 last:border-b-0"
>
  <td>...</td>
  ...
</TableRowLink>
```

`TableRowLink` ignores clicks on interactive elements (`a`, `button`, inputs, …). If you build a custom interactive region inside a row, add `data-row-no-nav` to opt out.

## Component variants (design-time contract)

Every reusable component must define a small set of variants.
Examples:

- `Card`: `default | subtle`
- `StatCard`: `standard | featured | compact`
- `Table`: `list | plain` (+ `minWidth` buckets)
- `Badge`: `neutral | ok | warn | danger`
- `Button`: `primary | secondary | ghost | ok | warn | danger` × `sm | md | lg`

This is where novelty goes—**not** in per-page custom styling.

## Applying information hierarchy without “random size”

Tier 0 (interrupt):
- use placement + banner/alert component
- not huge typography

Tier 1 (primary):
- use placement + one featured stat (optional)
- use standard controls in the header

Tier 2 (supporting):
- standard stat cards, compact bars

Tier 3 (deep):
- de-emphasize via muted text and secondary placement
- often hidden in Basic behind “Details”

## Acceptance criteria

- In a single screen, paddings and gaps visually align (no “off by 3px” feel).
- Stat cards in a grid feel uniform; prominence is driven by span + approved variants.
- Tables and toolbars align to the same control heights.
- Any new bespoke size is introduced via tokens/variants, never inline arbitrary CSS.

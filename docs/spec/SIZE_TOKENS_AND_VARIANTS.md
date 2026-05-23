# Size tokens and variants

Goal: prevent “random-sized” UI by introducing a small set of named size tokens that
cover the real layouts we use.

Principles:
- No ad-hoc `w-[...]`, `min-w-[...]`, `h-[...]`, `text-[...]` utilities.
- If a new size is needed:
  1) add a token in `src/styles/index.css`
  2) map it in `tailwind.config.js`
  3) document it here
  4) add it to `DESIGN_SANDBOX.md`

Last updated: 2026-01-25

## Where tokens live

- CSS variables: `src/styles/index.css`
- Tailwind mappings: `tailwind.config.js`
- Enforcement: `scripts/lint-tailwind-tokens.mjs` + `npm run lint:tailwind`

## Drawer widths

We standardize drawer widths to three variants:

| Variant | CSS var | Value | Tailwind class |
|---|---|---:|---|
| sm | `--drawer-w-sm` | `18rem` | `w-drawer-sm` |
| md | `--drawer-w-md` | `22rem` | `w-drawer-md` |
| lg | `--drawer-w-lg` | `28rem` | `w-drawer-lg` |

Responsive rule:
- On mobile, drawers should normally be full width: `w-full md:w-drawer-md` (or sm/lg).

Implementation:
- The shared `Drawer` component applies `w-full` on mobile and token widths on `md+`.

## Table scroll min-width buckets

These are **transitional** tokens for desktop tables during migration to mobile-friendly
card layouts. Prefer “cards on mobile, table on desktop” over relying on horizontal scroll.

| Bucket | CSS var | Value | Tailwind class |
|---|---|---:|---|
| sm | `--table-min-w-sm` | `40rem` (640px) | `min-w-table-sm` |
| md | `--table-min-w-md` | `45rem` (720px) | `min-w-table-md` |
| lg | `--table-min-w-lg` | `52.5rem` (840px) | `min-w-table-lg` |

Usage:
- When using a scroll wrapper: `overflow-x-auto` + table `min-w-table-md`.
- Do not “fix” mobile by forcing scroll. See: `LIST_DENSITY_CONTRACT.md`.

## Console frame sizing

The VPS console iframe has a responsive height token:

| Token | CSS var | Value | Tailwind class |
|---|---|---:|---|
| console height | `--console-h` | responsive | `h-console` |

Defined as:
- base: `70vh`
- `md+`: `75vh`
- `lg+`: `calc(100vh - 18rem)`

Rationale:
- keep console usable without scrolling the page excessively
- allow a stable “console region” across layouts

## Content max-width tokens

Used for long, monospaced-ish or unbroken content (DNS records, logs, etc.) to keep
layout readable.

| Token | CSS var | Value | Tailwind class |
|---|---|---:|---|
| content-sm | `--content-max-w-sm` | `34rem` | `max-w-content-sm` |
| content-lg | `--content-max-w-lg` | `48rem` | `max-w-content-lg` |

## Textarea min-height

| Token | CSS var | Value | Tailwind class |
|---|---|---:|---|
| textarea min height | `--textarea-min-h` | `120px` | `min-h-textarea` |

Use when we want a “comfortable default” input size without hardcoding `min-h-[...]`.

## Adding a new size token

Checklist:
- [ ] add CSS var in `src/styles/index.css`
- [ ] map to Tailwind in `tailwind.config.js`
- [ ] add to this doc
- [ ] add to `DESIGN_SANDBOX.md`
- [ ] run `npm run lint:tailwind`

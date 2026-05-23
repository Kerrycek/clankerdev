# Tailwind tokenization policy

Purpose: keep the UI consistent, theme-safe, and maintainable by preventing
ad-hoc sizes and one-off colors.

This policy is enforced by:
- `scripts/lint-tailwind-tokens.mjs`
- `npm run lint:tailwind`

Last updated: 2026-01-25

## 1) No arbitrary size utilities

Forbidden across `src/`:
- `w-[...]`
- `min-w-[...]`
- `max-w-[...]`
- `h-[...]`
- `min-h-[...]`
- `text-[...]`

If you need a new size:
- add a token (see: `SIZE_TOKENS_AND_VARIANTS.md`)

### Why

Arbitrary values create “random rhythm” across screens:
- inconsistent padding / widths
- misaligned rows and cards
- unreviewable visual drift

Tokens make sizing deliberate and reusable.

## 2) Semantic colors in shared UI components

In `src/components/ui/*`:
- Do not use hard-coded utility colors like:
  - `text-black/...`, `bg-white`, `border-black/...`, `ring-black/...`, `bg-black/...`
- Use semantic tokens instead (see: `THEME_TOKENS.md`)

Examples:
- `bg-surface`, `bg-surface-2`
- `text-fg`, `text-muted`, `text-faint`
- `border-border`
- focus ring: `focus:ring-focus/35 focus:ring-offset-2 focus:ring-offset-bg`

## 3) Allowed “structural” arbitrary utilities

Not all bracket syntax is bad — some cases represent *structure*, not “random sizing”.
Examples that can be acceptable (review required):
- grid templates: `grid-cols-[1fr_auto]`
- content utilities: `content-['']`

However:
- do not encode pixel/rem sizes in those structures
- prefer simpler layouts (flex) when possible

This is intentionally *not* enforced yet — we only enforce the “random size” forms.

## 4) Enforcement workflow

- Run locally:
  - `npm run lint:tailwind`
- CI (future):
  - add `npm run lint` to the pipeline
- Code review:
  - reject new arbitrary sizes unless a token is introduced

## 5) Migration strategy

1) Fix shared primitives first (`src/components/ui`)
2) Tokenize layout primitives (`AppLayout`, `PublicLayout`, common headers)
3) Tokenize pages gradually (starting with the most used: VPS list/detail, tasks, DNS, transactions)
4) Enable default `system` theme after pages are mostly tokenized

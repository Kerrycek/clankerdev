# Drift fixlist — tokenization (Iteration M)

This document records the concrete “drift fixes” applied during Iteration M:
replacing ad-hoc Tailwind values with named tokens/variants.

Last updated: 2026-01-25

## Completed replacements

### Drawer widths

| Before | After | Notes |
|---|---|---|
| `w-[18rem]` | `w-full md:w-drawer-sm` | mobile drawers become full-width |
| `w-[22rem]` | `w-full md:w-drawer-md` | default drawer width |
| `w-[28rem]` | `w-full md:w-drawer-lg` | large drawers |

Implementation:
- `src/components/ui/Drawer.tsx`
- Token definitions:
  - `--drawer-w-sm/md/lg` in `src/styles/index.css`
  - Tailwind mapping in `tailwind.config.js`

### Table min-widths (desktop scroll buckets)

| Before | After |
|---|---|
| `min-w-[640px]` | `min-w-table-sm` |
| `min-w-[720px]` | `min-w-table-md` |
| `min-w-[760px]` | `min-w-table-md` *(bucketed)* |
| `min-w-[840px]` | `min-w-table-lg` |

Files:
- `src/pages/app/vps/VpsNetworkPage.tsx`
- `src/pages/app/vps/VpsFeaturesPage.tsx`
- `src/pages/app/vps/VpsMaintenancePage.tsx`
- `src/pages/app/vps/VpsStoragePage.tsx`

### Console iframe height

| Before | After |
|---|---|
| `h-[70vh] md:h-[75vh] lg:h-[calc(100vh-18rem)]` | `h-console` |

File:
- `src/pages/app/vps/VpsConsolePage.tsx`

Token:
- `--console-h` (responsive via media queries) → `h-console`

### Content max-width buckets

| Before | After |
|---|---|
| `max-w-[34rem]` | `max-w-content-sm` |
| `max-w-[48rem]` | `max-w-content-lg` |

Files:
- `src/pages/app/dns/DnsZoneRecordsPage.tsx`
- `src/pages/app/dns/DnsZoneLogsPage.tsx`

### Textarea min height

| Before | After |
|---|---|
| `min-h-[120px]` | `min-h-textarea` |

File:
- `src/pages/app/admin/MigrationPlanDetailPage.tsx`

### Arbitrary font size cleanup

| Before | After |
|---|---|
| `text-[11px]` | `text-xs` |

Files:
- `src/pages/app/TransactionChainsPage.tsx`
- `src/pages/app/TransactionsListPage.tsx`
- `src/components/ui/ChipLink.tsx` (also cleaned)

## Shared UI primitives cleaned

Shared UI components (`src/components/ui`) no longer contain:
- `text-black/...`
- `bg-white`
- `border-black/...`
- `ring-black/...`
- `bg-black/...`
- size arbitraries (`text-[...]`, `w-[...]`, ...)

See enforcement:
- `scripts/lint-tailwind-tokens.mjs`
- `npm run lint:tailwind`

## Remaining drift (known)

- Many *pages* still use `text-black/...` and `bg-white` utilities.
  - This is acceptable while the default theme is pinned to light (`index.html`),
    but it must be migrated before defaulting to `system` theme.
- Some “structural” bracket utilities remain (example: `grid-cols-[1fr_auto]`).
  - These are not “random sizes” and are currently permitted.
  - If they grow, consider converting to flex layouts or adding a more formal allowlist.

## Next steps

- Continue tokenizing layout primitives (`AppLayout`, `PublicLayout`) so most pages inherit correct colors.
- Tokenize the highest-traffic pages first (VPS list/detail + Tasks).
- When coverage is high, switch default theme to `system` and expose theme toggle in settings.

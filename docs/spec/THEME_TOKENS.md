# Theme and design tokens

We want the UI to feel related to vpsFree.cz (navy + warm accent),
but be **more readable** than the website hero sections.

Requirements:
- Provide **light mode** and **dark mode**.
- Provide a **system** option (follow OS/browser preference) once the UI is fully tokenized.
- Ensure high contrast (WCAG-minded; avoid low-contrast gray-on-gray).
- Avoid hard-coded `black/white` utility colors in **shared UI components**; use semantic tokens.

Last updated: 2026-02-11

## Theme model

- Theme values:
  - `system`
  - `light`
  - `dark`
- The selected theme is stored in UI settings.
- The current theme is applied by setting a `data-theme` attribute on `<html>`:
  - `data-theme="light"` or `data-theme="dark"`

### Current bootstrap state

Theme switching is **enabled**.

- The user's preference is stored in UI settings (`settings.theme`).
- The theme is applied by setting `data-theme` on `<html>` (`light` / `dark`).
- For `system`, we **remove** `data-theme` and rely on `prefers-color-scheme`.

To avoid "flash of wrong theme", we apply a tiny bootstrap snippet before React mounts:

- `index.html`: reads `localStorage['vpsadmin.uiSettings.v1']` and sets:
  - `data-theme` (for explicit light/dark)
  - `lang` (for explicit/system language)

Runtime application is handled by `src/app/theme.tsx`.

Note:
- Some older pages may still contain legacy `text-black/...` and `bg-white` utilities.
  These should be progressively tokenized. The app chrome + public pages + profile are tokenized.

## Token naming + representation

- **CSS variables** store RGB triplets: `--c-<token>: r g b;`
- Tailwind uses: `rgb(var(--c-<token>) / <alpha-value>)`

This enables alpha modifiers like:
- `bg-surface/80`
- `text-fg/70`
- `border-border/60`

Token definitions live in:
- `src/styles/index.css` (source of truth)
- `tailwind.config.js` (Tailwind mapping)

## Semantic color tokens

Core surfaces:
- `--c-bg` – app background
- `--c-surface` – card backgrounds, main panels
- `--c-surface-2` – subtle panels, table header backgrounds, hover backgrounds
- `--c-border` – borders and separators

Typography:
- `--c-fg` – primary text
- `--c-fg-muted` – secondary text
- `--c-fg-faint` – tertiary/hint text
- `--c-link` – link text

Accent:
- `--c-accent` – primary action/background
- `--c-accent-hover`
- `--c-accent-fg` – text on accent

Status colors:
- `--c-ok` / `--c-ok-bg`
- `--c-warn` / `--c-warn-bg`
- `--c-danger` / `--c-danger-bg`

Focus:
- `--c-focus` – focus ring hue (usually same as accent)

Overlay:
- `--c-overlay` – modal/drawer overlay base (use alpha in classes)

## Proposed palette

These values are recommended defaults. We can tune them visually during implementation.

### Light theme

| Token | Hex | RGB triplet |
|---|---:|---:|
| bg | `#f7f8fb` | `247 248 251` |
| surface | `#ffffff` | `255 255 255` |
| surface-2 | `#f1f5f9` | `241 245 249` |
| border | `#e2e8f0` | `226 232 240` |
| fg | `#0f172a` | `15 23 42` |
| fg-muted | `#475569` | `71 85 105` |
| fg-faint | `#64748b` | `100 116 139` |
| link | `#0f172a` | `15 23 42` |
| accent | `#f59e0b` | `245 158 11` |
| accent-hover | `#d97706` | `217 119 6` |
| accent-fg | `#111827` | `17 24 39` |
| ok | `#059669` | `5 150 105` |
| ok-bg | `#ecfdf5` | `236 253 245` |
| warn | `#d97706` | `217 119 6` |
| warn-bg | `#fffbeb` | `255 251 235` |
| danger | `#e11d48` | `225 29 72` |
| danger-bg | `#fff1f2` | `255 241 242` |
| overlay | `#000000` | `0 0 0` |
| focus | `#f59e0b` | `245 158 11` |

### Dark theme (inspired by vpsFree.cz)

| Token | Hex | RGB triplet |
|---|---:|---:|
| bg | `#0b1220` | `11 18 32` |
| surface | `#0f1b2d` | `15 27 45` |
| surface-2 | `#14223a` | `20 34 58` |
| border | `#273346` | `39 51 70` |
| fg | `#e5e7eb` | `229 231 235` |
| fg-muted | `#cbd5e1` | `203 213 225` |
| fg-faint | `#94a3b8` | `148 163 184` |
| link | `#e5e7eb` | `229 231 235` |
| accent | `#f59e0b` | `245 158 11` |
| accent-hover | `#fbbf24` | `251 191 36` |
| accent-fg | `#111827` | `17 24 39` |
| ok | `#34d399` | `52 211 153` |
| ok-bg | *(tinted)* | `24 55 69` |
| warn | `#fbbf24` | `251 191 36` |
| warn-bg | *(tinted)* | `48 53 55` |
| danger | `#fb7185` | `251 113 133` |
| danger-bg | *(tinted)* | `52 45 68` |
| overlay | `#000000` | `0 0 0` |
| focus | `#f59e0b` | `245 158 11` |

## Tailwind mapping

Examples (implemented in `tailwind.config.js`):

- `bg-bg` → `rgb(var(--c-bg) / <alpha-value>)`
- `bg-surface` → `rgb(var(--c-surface) / <alpha-value>)`
- `bg-surface-2` → `rgb(var(--c-surface-2) / <alpha-value>)`
- `border-border` → `rgb(var(--c-border) / <alpha-value>)`
- `text-muted` → `rgb(var(--c-fg-muted) / <alpha-value>)`
- `bg-accent` → `rgb(var(--c-accent) / <alpha-value>)`
- `bg-overlay-surface` → `rgb(var(--c-overlay-surface) / <alpha-value>)`
- `bg-backdrop` → `rgb(var(--c-backdrop) / <alpha-value>)`

## Shared UI component rules

Shared UI components (in `src/components/ui`) must be theme-safe.

Avoid:
- `text-black/70`, `bg-white`, `border-black/10`, `ring-black/20`, etc.

Prefer:
- `bg-surface`, `bg-surface-2`, `text-fg`, `text-muted`, `text-faint`, `border-border`
- focus ring: `focus:ring-focus/35 focus:ring-offset-2 focus:ring-offset-bg`

### Examples

Overlay panels must stay fully opaque. Their shared page backdrop is translucent so
the surrounding application remains visible and keeps the user oriented. Do not
blur the page or reduce the opacity of the panel itself.

- **Card**: `bg-surface border-border shadow-card`
- **Input/Select/Textarea**: `bg-surface border-border` + `focus:ring-focus/35`
- **Modal/Drawer**:
  - backdrop: `bg-backdrop/45` *(translucent; no blur or gradients)*
  - panel: `bg-overlay-surface ring-1 ring-border shadow-panel`

## Non-color tokens

See also: `SIZE_TOKENS_AND_VARIANTS.md` and `DESIGN_SYSTEM_FOUNDATIONS.md`.

Implemented tokens include:
- Radii: `--radius-lg/md/sm`
- Shadows: `--shadow-card`, `--shadow-panel`
- Sizes: drawers, table min-width buckets, console height, etc.

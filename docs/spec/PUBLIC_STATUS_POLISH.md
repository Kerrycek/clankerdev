# Public status landing polish

This spec refines the public Overview (`/`) as the “status landing”.
It is explicitly **not** the marketing homepage; it is a transparency page
that must be instantly useful.

Last updated: 2026-01-25

## Purpose

- Let anyone answer quickly:
  - Are there any ongoing incidents?
  - Is the cluster generally healthy?
  - Where can I find details (outages/news/nodes)?

## Information priority (applies to layout and visual weight)

See `INFORMATION_HIERARCHY.md`.

Tier 0 (interrupt):
- Ongoing outage(s)
- Nodes down (or missing status)
- Planned maintenance starting soon

Tier 1 (primary):
- Overall cluster state badge
- **Members** count (from `Cluster::PublicStats.user_count`)

Tier 2 (supporting):
- VPS count
- Node health summary (X/Y nodes up)

Tier 3 (deep/rare):
- IPv4 left (unless low)

## Hero section

Desktop:
- Left: Title + subtitle
  - Title: “Status” / “Stav služby”
  - Subtitle: “Cluster health, outages, and recent news.”
- Right: a **tasteful brand-inspired graphic** (small, subtle)

Mobile:
- Title + badge first
- Graphic is optional; if present, it must not push Tier 0/1 content below the fold.

### Graphic guidance

- Use a single inline SVG (no external assets required).
- Style:
  - thin outline iconography, inspired by vpsFree.cz (heart + server lines)
  - no heavy gradients
  - no large saturated areas that reduce readability
- The graphic must respond to theme:
  - uses `currentColor` or CSS variables
  - stays subtle in both light and dark

## Cluster state badge

Immediately below the title (Tier 0/1):
- When there are ongoing outages: show **Incident in progress** (danger)
- When no ongoing outages: show **All systems nominal** (info/ok)

Rule:
- The badge is never color-only; it must include text.

## Stats layout (Members must be visually primary)

### Desktop grid proposal

Use a 12-column grid with unequal emphasis:

Row 1:
- Members (span 6) — biggest number
- Node health (span 3) — “X/Y up” + tiny bar
- VPS count (span 3)

IPv4 left is **not its own headline card** in normal conditions.
It is shown as a small tertiary line/badge in the VPS card footer.

(Optional later) Row 2:
- “Last updated” / “Data freshness” (span 12)

Sizing discipline (avoid “random”):
- Stat cards use the `StatCard` system from `DESIGN_SYSTEM_FOUNDATIONS.md`.
- All stat cards in the grid share the same height.
- “Members” becomes visually primary via **span** and the `featured` typography variant,
  not by making the card arbitrarily taller.

### Mobile order

1) Cluster state badge
2) Members
3) Node health
4) VPS count
5) IPv4 free (tertiary; usually shown within VPS card)

### IPv4 left thresholding

IPv4 left is Tier 3 unless low.

We treat this as **configurable thresholds** (runtime config), because absolute
values can change over time.

Default recommended thresholds:
- `warn` when `ipv4_left <= 64`
- `critical` when `ipv4_left <= 16`

Implementation note:
- thresholds live in `getRuntimeConfig().publicStatus` and can be overridden via:
  - `window.vpsAdmin.webuiNext.publicStatus` (integrated webui)
  - env vars `VITE_PUBLIC_IPV4_WARN` / `VITE_PUBLIC_IPV4_CRITICAL` (build-time)

Behavior:
- Normal: show IPv4 free as a **small badge** in the VPS stat card footer.
- Warn: keep as badge, but variant becomes `warn`; optionally add a short footer hint.
- Critical: upgrade to Tier 0:
  - show a top alert (“Public IPv4 addresses are running low”).
  - optionally promote IPv4 to its own stat card in Row 1 (span 3) if it must be seen immediately.

## Outages and News layout

Desktop:
- Two columns:
  - Left: Outages (current/planned/resolved)
  - Right: News (latest)

Mobile:
- Stack with Outages first.

Outages list:
- If ongoing exists: show up to 3 ongoing, then a link.
- If no ongoing: show planned, else recent resolved.

## Nodes section

The nodes section is a scan surface.

### Grouping

- Group by location (location label).
- Each location group header shows:
  - location name
  - summary: `ok / down / total`
  - a tiny “up ratio” bar is allowed (nice-to-have)

### Mobile behavior

- Location groups are **collapsible accordions**.
- Default expansion rules:
  - if a group contains any down nodes → expanded
  - else the first group may be expanded
  - everything else collapsed

This keeps the page short while still surfacing problems.

Implementation note:
- we implement this using native `<details>` accordions (a11y-friendly).
- rule: groups with down nodes are expanded; otherwise the first group is expanded.

### Node row/card contents

We keep it simple and public:
- Node name
- Status (up/down)
- Last report time
- VPS count + free (if provided)
- CPU idle (if provided)

Mobile representation:
- cards, not a wide table
- each card shows:
  - name + status badge
  - last report
  - CPU idle (optional)

## Reachability when authenticated

Authenticated users must still reach public status easily:
- add “Public status” link to user menu
- optionally also in sidebar (Advanced and Basic)

## Acceptance criteria

- “Members” is visually more prominent than “IPv4 left” in normal conditions.
- Tier 0 items (ongoing outage / low IPv4 critical) are visible without scrolling.
- On mobile, nodes are readable without horizontal scrolling.
- Location groups with problems open automatically.

Test IDs (minimum):
- `public.overview.page`
- `public.summary-grid`
- `public.stats.members`
- `public.stats.nodes`
- `public.stats.vps`

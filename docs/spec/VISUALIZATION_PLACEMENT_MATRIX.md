# Visualization placement matrix

This document is the **authoritative map** of where we use charts/gauges/bars,
and where we intentionally **do not**.

It exists to prevent “random” visualization creep.

Last updated: 2026-02-01

## Global rules

1) **A visualization must answer a question faster**
- If a number is enough, we do not add a chart.
- If the user cannot act differently based on the visualization, we do not add it.

2) **No chart-only truth**
- Every visual must have a textual/numeric fallback.
- Never encode critical state using color alone.

3) **No N+1 requests for visuals**
- List pages may only visualize data already present in the list endpoint.
- Time-series charts are **detail-page only** and loaded lazily.

4) **Mode-aware density**
- **Basic**: larger, friendlier visuals (GaugeRing), fewer columns, fewer charts.
- **Advanced**: denser visuals (UsageBar), more columns, optional sparklines.

5) **Mobile-first constraints**
- No horizontal scrolling for core information.
- Charts must not trap scroll.
- Tooltips become tap-to-reveal.

## Standard primitives (v1)

These are the only allowed visualization primitives in v1.
They are implemented in `src/components/ui`.

- `StatCard` — KPI number with optional subtitle/footer and optional right-side visual.
- `GaugeRing` — basic-friendly ring for ratios (must be accompanied by text).
- `UsageBar` — advanced-friendly bar for used/limit (implemented: `src/components/ui/UsageBar.tsx`).
- `StackedBar` — compact distribution bar (e.g., up/down, outage categories).
- `Sparkline` — tiny trend line (optional; used sparingly).

- `TimeSeriesChart` — lightweight SVG time-series line chart (single series) for detail pages.

Time series charts:
- v1 implementation: internal SVG (`TimeSeriesChart`).
- Future candidate: uPlot (only if we accept the dependency + bundle impact).

## Placement by screen

### Public

#### `/` Public status overview

Tier intent:
- Tier 0: outage banner (Alert)
- Tier 1: Members
- Tier 2: nodes up ratio, VPS count
- Tier 3: IPv4 free (unless low)

Visuals:
- Summary grid:
  - `StatCard(featured)` for **Members**.
  - `StatCard` + `GaugeRing` for Nodes up ratio.
  - `StatCard` for VPS count.
  - IPv4 free is shown as a **small badge** in the VPS card footer.
- Outages card:
  - `StackedBar` showing current/planned/resolved distribution.
- Nodes by location:
  - Mobile: accordions (`<details>`) + node cards (no horizontal scroll).
  - Desktop: location header includes a `StackedBar` (up/down) + dense table.

Data sources:
- `Cluster::PublicStats` for Members/VPS/IPv4.
- `Node::PublicStatus` for node availability.
- `Outage::PublicIndex` for distribution.

Why this is worth it:
- Members count is immediately visible.
- Any node-down situation is visible as a ratio drop + location headers.
- Outage list becomes scannable without reading every row.

#### `/outages`, `/news`

No charts.
- These are text feeds. The visual weight is in badges and grouping, not graphs.

### App (user/admin)

#### `/app` Dashboard

Advanced:
- Top KPI row as `StatCard`s:
  - Running VPS / total
  - Active tasks
  - Recent failures / warnings
- Optional `Sparkline` only if we already have trend data in the same endpoint.

Basic:
- “What do you want to do?” action cards.
- Limited KPIs; no sparklines.

#### `/app/vps` VPS list

Advanced:
- Table with usage visuals per row:
  - Memory: `UsageBar`
  - Disk: `UsageBar`
  - Load: optional small numeric triple (1/5/15) and/or `Sparkline` (only if cheap)

Basic:
- Card list:
  - Runtime pill
  - 2–3 biggest KPIs as `GaugeRing`s (Memory/Disk)

Performance:
- Must use fields already in `VPS::Index` (no per-row status fetch).

#### `/app/vps/:id` VPS detail

Overview (Tier 0/1):
- `StatCard`s / summary tiles:
  - Runtime state
  - SSH connect string
  - Busy/lock pill
- Usage:
  - Advanced: `UsageBar`s
  - Basic: `GaugeRing`s

Metrics panel:

- Implemented: Overview tab card (advanced visible; basic behind disclosure).
- `TimeSeriesChart` for:
  - CPU load
  - Memory
  - Disk
Default window `24h` (hourly samples).

### Admin

#### `/admin/nodes` Nodes list

Advanced only:
- Dense table.
- Optional `Sparkline` per node for loadavg if the backend can provide it cheaply.
- Node availability summary as a `StackedBar` at the top.

#### `/admin/nodes/:id` Node detail

Implemented:
- `TimeSeriesChart` for:
  - Load (1m) (from `loadavg1`)
  - CPU idle %
  - Memory used %
Default windows: `6h`, `24h`, `7d`.

## Review checklist

When adding a visualization, verify:

- Does it change a decision, or just look cool?
- Is the numeric fallback present?
- Does it avoid N+1 calls?
- Does it remain readable on mobile?
- Are the semantics consistent with the Tier maps?

See also:
- `docs/spec/DATA_VISUALIZATION.md`
- `docs/spec/INFORMATION_PRIORITY_MAPS.md`
- `docs/spec/PUBLIC_STATUS_POLISH.md`
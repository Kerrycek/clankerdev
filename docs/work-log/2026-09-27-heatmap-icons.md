# Icon-only heatmap actions

Migrated from the original work log; entries retain their recorded status at the
time of writing. Later entries below supersede earlier status statements.
Dates use Europe/Prague unless explicitly marked UTC.

Subsequent release evidence: [heatmap, favicon and handbook release](2026-09-27-heatmap-favicon-release.md).

## 2026-09-27 — Icon-only node heatmap actions

**Request:** show only the heatmap icon in each node row instead of repeating
“Heatmap” / “Heatmapa”.

**Change:** [PR #521](https://github.com/Kerrycek/clankerdev/pull/521), commit
`a589cad3`, removes the button text in public/member/admin lists. Localized tooltip
and accessible name still identify the heatmap and its node.

**Verification:** typecheck, lint, build, and 16 existing Chromium desktop/mobile
heatmap fixture cases passed, covering cs/en, opening/closing the dialog,
eligibility, and missing configuration. Assertions now verify an icon-only control
with its accessible name and tooltip.

**Status / next:** PR prepared; not merged or deployed. Review CI before release.

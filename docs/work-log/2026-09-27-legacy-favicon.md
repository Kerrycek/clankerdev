# Legacy favicon

Migrated from the original work log; entries retain their recorded status at the
time of writing. Later entries below supersede earlier status statements.
Dates use Europe/Prague unless explicitly marked UTC.

Subsequent release evidence: [heatmap, favicon and handbook release](2026-09-27-heatmap-favicon-release.md).

## 2026-09-27 - Reuse the legacy favicon

**Request:** bring the old UI favicon into WebUI Next.

**Change:** [PR #524](https://github.com/Kerrycek/clankerdev/pull/524), commit
`77a978e3`, copies the legacy 48x46 PNG unchanged to `public/favicon.png` and adds
an explicit root-relative favicon link in `index.html`, including nested routes.
The original legacy UI asset is unchanged.

**Verification:** production build passed; emitted HTML includes the link and
byte comparisons confirm the built PNG matches the source and legacy image.

**Status / next:** prepared, not merged or deployed. Review CI before release.
This entry is maintained in the pending work-log PR #523 so the favicon PR can
remain independent of the documentation setup.

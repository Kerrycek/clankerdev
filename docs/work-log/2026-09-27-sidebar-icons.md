# Sidebar icons and navigation

Migrated from the original work log; entries retain their recorded status at the
time of writing. Later entries below supersede earlier status statements.
Dates use Europe/Prague unless explicitly marked UTC.

## 2026-09-27 — Distinct sidebar icons and readable compact navigation

**Request:** remove duplicate menu icons and keep navigation understandable through
short visible labels.

**Change:** [PR #522](https://github.com/Kerrycek/clankerdev/pull/522), commit
`4e287bd0`, replaces repeated symbols with destination-specific icons. The compact
sidebar is a 176px labeled list instead of a 64px icon rail. Long destinations have
short Czech/English labels; full names remain in accessible names and tooltips.
The expanded sidebar stays 256px and mobile keeps its labeled drawer.

**Verification:** typecheck, lint, translation audit, build, 9 existing sidebar unit
tests, and 10 desktop/mobile dashboard and settings-persistence browser cases
passed. Eight synthetic visual previews covered user/admin, cs/en and light/dark:
no clipped compact labels or duplicate icons. Czech dark admin preview visually
inspected. Preview images and browser/build logs are local operator evidence,
not yet archived in repository CI artifacts.

**Status / next:** PR prepared; not merged or deployed. Review the intentionally
wider compact mode and CI before considering release. No permission/API changes.
## 2026-09-27 - Keep normal sidebar width; revise PR522 to icons only

**Request / reason:** the maintainer already uses the full labeled menu and does
not want it narrowed. The previous 176px compact preview over-interpreted the
shared feedback about icons and labels.

**Change:** PR522 now preserves the existing 256px expanded sidebar, full cs/en
labels, group headings, mobile drawer and optional collapse behavior. Withdraw
new compact widths and abbreviated translations. Keep distinct destination icons,
explicit accessible link names and decorative icon hiding. Update REQ-004,
product design and DEC-011 to record the superseded proposal. Include the earlier
release receipt in this documentation update instead of creating another PR.

**Verification:** typecheck, lint, design/active-doc audits, build, 9 existing
sidebar unit tests and 12 desktop/mobile dashboard/preferences fixture cases
passed. Eight synthetic user/admin, cs/en, light/dark previews confirmed a 256px
normal sidebar, visible labels/groups and distinct icons. Czech dark admin preview
was visually inspected. Preview images remain operator-held evidence.

**Status / next:** revised for review; not merged or deployed. Earlier narrow
sidebar screenshots describe the withdrawn proposal, not this revision.
## 2026-09-27 - Revised sidebar approved, merged and deployed

**Authorization / scope:** the maintainer approved deployment and testing of the
revised [PR522](https://github.com/Kerrycek/clankerdev/pull/522). The normal 256px
sidebar, full labels and groups remain intact; destination icons are distinct.
The withdrawn 176px proposal was not released.

**Release:** PR522 merged as `49c6a51d0b32c4a6d5dd1df426e0bac1d8066115`.
Both dev.crucio.cz and clankerdev.vpsfree.cz serve that frontend and matching BFF.
The merged tree equals the approved `ceed0e44` tree. The exact dev-built artifact
was promoted to the public host. Health, provenance and anonymous session checks
passed on both hosts. Previous runtime `92f96896` and rollback backups remain
available; no API, database, DNS or secret configuration was changed.

**Verification:** [static CI](https://github.com/Kerrycek/clankerdev/actions/runs/36331560750)
passed, including 1,514 unit, 135 script and 36 BFF tests.
[Browser CI](https://github.com/Kerrycek/clankerdev/actions/runs/36331560738)
passed 681 cases (378 desktop and 303 mobile). After deployment, 40 synthetic
fixture cases passed across both hosts: dashboard/preferences/mobile navigation
and user/admin, cs/en, light/dark sidebar checks, including 256px width, labels,
groups, distinct icons and collapse/expand behavior. Eight separate real anonymous
browser checks passed across both hosts, cs/en and desktop/mobile, with no page
errors and matching favicon bytes. These are not live authenticated lifecycle
certification. Screenshots and detailed receipts remain operator-held evidence.

**Status / next:** deployed and verified. PR496/507/509 and backend44 remain
excluded; autonomous development stays paused. This documentation-only follow-up
records the completed release for inclusion in the next documentation update.

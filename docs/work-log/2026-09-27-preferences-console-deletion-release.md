# Preferences, console and deletion release

Migrated from the original work log; entries retain their recorded status at the
time of writing. Later entries below supersede earlier status statements.
Dates use Europe/Prague unless explicitly marked UTC.

## 2026-09-27 — Preferences, console, and deletion release

*Retrospective entry from recorded release evidence, checked against GitHub on
2026-09-27. Deployment describes the completed release, not a continuous health
or provenance guarantee.*

**Request:** merge, deploy and test the prepared fixes, including persistent dark
mode, on dev.crucio.cz and clankerdev.vpsfree.cz.

**Changes merged:**

- [#517](https://github.com/Kerrycek/clankerdev/pull/517): open a console session
  on entering the console page, with bounded/deduplicated token creation and
  explicit failure/replacement behavior.
- [#518](https://github.com/Kerrycek/clankerdev/pull/518): admin soft/hard VPS
  deletion options, optional custom retention, and persistent accepted-request
  feedback linked to Tasks. Member deletion keeps its normal API path.
- [#519](https://github.com/Kerrycek/clankerdev/pull/519): save UI preferences via
  the keyed settings PUT endpoint, fixing theme persistence after a new login.
- [#520](https://github.com/Kerrycek/clankerdev/pull/520): update stale nightly
  power-action/forecast browser assertions without weakening runtime safeguards.

**Release:** `fd290b5ec1b22900e704e8cb990c5ba050af2394` was deployed to both hosts.
Its tree matched the tested integrated candidate. Frontend and BFF provenance
matched; existing configuration was preserved, with no API/database migrations.

**Verification recorded:** 1,514 unit, 131 script, 36 BFF tests; typecheck, lint,
translation/CSP audits and build passed. Targeted checks passed (180 Chromium and
16 WebKit). Full integrated PR smoke passed (378 desktop + 303 mobile = 681).
After deployment, 32 targeted Chromium fixture cases on each host plus 16 public
WebKit fixture cases passed. Actual anonymous provenance, health, session and auth
endpoint checks also passed on both hosts. No real VPS deletion or personal
preference mutation was used for browser regression tests.

**CI correction:** historical run
[36274080869](https://github.com/Kerrycek/clankerdev/actions/runs/36274080869)
failed because four test guards still expected the old settings path. Exact
method/path guards were corrected; replacement run
[36276637276](https://github.com/Kerrycek/clankerdev/actions/runs/36276637276)
passed 674 cases. The old failed run remains in history.

**Rollback:** previous release `2eef5193403258c88ec4fca79138898aaf4273cc` and
operator backups were retained. Restore the matching previous frontend/BFF release
using the [deployment documentation](../../deploy/README.md), then verify provenance
and auth/health checks.
Private backup locations and full release logs remain in the operator handoff;
they must be transferred securely for an operational handover.

**Known limitations / follow-up:** the dev API lacks the default VPS soft-delete
retention for its environment. A retention policy must be chosen before changing
shared configuration; the UI release did not resolve that API configuration issue.
An intermittent list-pagination issue from earlier nightly evidence is not claimed
fixed. Cursor PRs #496/#507/#509 and rejected backend PR #44 were excluded from
this release. Scheduled autonomous development remains paused.

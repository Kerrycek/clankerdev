# Project work log

This is the versioned record of work on vpsAdmin WebUI Next (Clankerdev),
started on 2026-09-27 at the maintainer's request for a future handover.
It records decisions and evidence; it does not replace the product specification,
Git history, deployment runbooks, or issue tracker.

Dates below use Europe/Prague unless an explicit UTC timestamp is given.
Entries before the start date are selective retrospective summaries, not a
complete reconstruction of the project. Missing evidence is not a passing check.

## Reading and maintaining this log

- Read the latest entries before starting work. Add an entry with each meaningful
  change, investigation, review outcome, deployment, or blocker.
- Record the request, what changed and why, PR/commit references, verification,
  deployment status, and a concrete next step or known limitation.
- State whether browser evidence used synthetic API fixtures, a real isolated
  API, or anonymous public endpoints. Do not describe fixture tests as live
  lifecycle certification.
- Append dated follow-ups for merge/deployment outcomes; retain earlier entries
  as history. A prepared PR is not a deployed change, and one green CI run does
  not establish release readiness for unrelated work.
- Link durable repository/CI evidence. If evidence exists only in an operator's
  local files, identify that limitation without publishing private paths or data.
- Do not store credentials, session tokens, personal data, private screenshots,
  or raw production responses. This log does not grant deployment authorization
  or enable autonomous scheduled development.

## 2026-09-27 - Restrict issue-to-PR runner to trusted work

**Request:** inspect the dev issue runner and restrict automatic token use to
Kerrycek and vpsfreecz members; other authors require human approval (REQ-067).

**Finding:** the timer is enabled and polls approximately every 15 minutes. Recent
runs succeeded with an empty ai-fix queue; GitHub and Codex authentication are
available. No new model invocation was made for diagnosis. The installed runner
had a new-issues-first selection patch absent from Git; preserve it.

**Change:** authorize before any GitHub write, worktree reset or model call.
Check explicit logins and active organization membership; outsiders need a
repository writer's approval of the exact issue-content digest. Filter untrusted
PR feedback and ignore it in revision hashes. API uncertainty fails closed.
Add a read-only dry run, install/rollback instructions and policy/shell regressions.

**Verification:** 11 focused policy/shell cases passed locally and on the dev
Linux host. All 146 script tests, lint and design/active-doc audits passed locally.
A real read-only queue check passed on the host with no queued issues, no model
call and no GitHub writes.

**Installed outcome:** the requested restriction is installed on the idle dev
runner from commit `bb77a618`, under its existing lock. Private backups retain the
old script/environment; the timer remains enabled and active. Post-install dry
run passed, and real API checks confirmed organization visibility and approval
permission. No live model invocation or end-to-end PR creation was triggered.
The repository change is prepared for review; it has not been merged.

## 2026-09-27 - Repair PR525 documentation audit test fixtures

**Failure:** CI run 36333825895 failed three script tests. The updated audit
requires the root redesign index and scans Git-tracked paths; the isolated test
fixture supplied neither. The failure reproduced locally. The earlier direct
audit checks passed against the real checkout but did not cover this fixture.

**Fix:** include the index and initialize/stage the temporary fixture repository.
Keep the audit strict. Add cases proving that valid bridge links and historical
mentions pass, external references in docs/source fail, and broken links inside
the bridge fail. Existing inventory and requirement checks remain in place.

**Verification:** all seven focused documentation tests passed. The full local
`npm run ci:pr` passed: audits/lint/typecheck, 138 script tests, 36 BFF tests and
1,514 unit tests. No runtime or deployment change.

## 2026-09-27 - Repair missing redesign-spec references

**Request:** make the referenced UI_REDESIGN.md available to repository readers.
The original external file was not found in the available workspace or Clankerdev
Git history. Its precise contents remain unknown; the existing design handbook
is the maintained replacement, not a reconstruction of the missing document.

**Change:** add a root compatibility navigation page; replace external pointers
in historical stubs and source comments with in-repository documentation. Mark
the March route audit as historical and replace unverifiable numbered citations
with related current workflow links. Include the previous sidebar release receipt.

**Verification / status:** 121 local links/anchors checked; design and active-doc
audits and diff whitespace validation passed. A negative check confirmed the audit
rejects a restored external sibling reference. No runtime behavior change or
deployment needed.
Prepared for review. Historical requirements are not claimed to be fully recovered.

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

## 2026-09-27 - Approved heatmap and favicon release

**Authorization:** the maintainer approved PR521, PR523 and PR524 for merge and
release. PR522 is explicitly held for visual review; PR496/507/509 and backend44
remain excluded. The proposed webui.vpsfree.cz alias was canceled before changes.
Scheduled autonomous development remains paused.

**Runtime release:** PR521 and PR524 were merged after their exact-head CI passed.
Both dev.crucio.cz and clankerdev.vpsfree.cz now serve frontend and matching BFF
`92f968960bec47d19eca78b47db219969fecc3ed`. The public host uses the exact dev-built
frontend artifact. Sidebar, backend/API configuration and secrets are unchanged.
Documentation PR523 is tracked separately and requires no runtime redeployment.

**Verification:** the integrated approved candidate passed 1,514 unit, 135 script
and 36 BFF tests, typecheck, lint, translation/CSP/documentation audits and build;
16 targeted desktop/mobile cs/en heatmap fixture cases passed. Favicon PR CI
passed 378 desktop + 303 mobile cases. After deployment, 22 fixture browser cases
passed on each host (44 total). Eight actual anonymous browser scenarios covered
both hosts, cs/en and desktop/mobile: favicon bytes match the legacy image,
root/deep routes resolve the icon, provenance matches and no page errors occurred.
Public clankerdev node actions contain only icons with accessible labels/tooltips;
the dev public API did not expose heatmap actions, so its action behavior is covered
by fixture evidence. Health, anonymous session and authentication endpoints passed.
No private API mutation or real VPS lifecycle action was used for these checks.

**Rollback:** matching previous release `fd290b5ec1b22900e704e8cb990c5ba050af2394`
is retained on both hosts together with private webroot/config snapshots. Restore
that matching frontend/BFF pair and recheck provenance/auth/health if needed.
Detailed scripts and receipts remain operator-held; see the handover limitations
in [Operations](docs/design/OPERATIONS.md).

**Status / next:** runtime release complete. Documentation PR523 passed all
378 desktop + 303 mobile CI cases and was merged as
`7e97d2919f908b175b6f8bc5b7ff899f1f59cec4`. Its changes are documentation and
development audits only; runtime source is identical to deployed `92f96896`,
so no second runtime deployment was needed. Retain the explicit PR522 review
hold and the excluded cursor/backend work. This follow-up receipt is maintained
on a separate documentation branch for the next reviewed documentation update.

## 2026-09-27 - Repository-contained design and requirements handbook

**Request:** provide complete English design documentation in docs/, including
recoverable maintainer requirements, what exists, why, how decisions evolved,
and a maintained current list for handover.

**Change:** expanded the existing documentation PR
[#523](https://github.com/Kerrycek/clankerdev/pull/523) instead of creating duplicate
setup work. Added the [handbook](docs/design/README.md), 66 stable requirements
with source/acceptance/status, product and workflow design, architecture, API
contracts, decision history, verification gates, operations and source limitations.
The previous specification pointed outside the repository to an unavailable
UI_REDESIGN.md; current entry points now resolve inside the repository. Historical
fragments remain classified as archaeology, not competing requirements.

Added generated inventory of 256 route entries (including layouts/index routes)
and 63 API adapter modules. CI now checks inventory drift, handbook link targets
and requirement references. AGENTS.md requires updates with relevant behavior
changes. Inaccessible history, unverified legacy parity, incomplete live lifecycle
certification and private operational handover remain explicitly identified.

**Verification:** docs inventory/links/IDs and active-doc audits passed; all 135
script tests passed, including 4 new checks of inventory extraction, drift, broken
links/requirement references and unresolved imported route groups. No product
runtime change; no live mutations or deployment performed.

**Status / next:** prepared for review. Review the recovered requirement intent,
assign owners to open decisions/evidence gates, and retain ongoing updates.
The documentation does not complete the independent audit or authorize a beta.

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

## 2026-09-27 — Work log established

**Request:** keep an ongoing record to support a complete project handover.

**Change:** introduce this log, link it from the main README, and add a maintenance
rule to AGENTS.md. Seed it with the verified recent release and the two current UI
PRs. Older development is still available through Git/PR history; it has not been
invented or silently marked complete here.

**Verification:** documentation diff and local link checks. No runtime change.

**Status / next:** documentation prepared for review. Maintain entries with future
work and merge/deployment outcomes. Full handover documentation and an independent
code audit remain separate work; creating this log does not complete them.

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
using the [deployment documentation](deploy/README.md), then verify provenance
and auth/health checks.
Private backup locations and full release logs remain in the operator handoff;
they must be transferred securely for an operational handover.

**Known limitations / follow-up:** the dev API lacks the default VPS soft-delete
retention for its environment. A retention policy must be chosen before changing
shared configuration; the UI release did not resolve that API configuration issue.
An intermittent list-pagination issue from earlier nightly evidence is not claimed
fixed. Cursor PRs #496/#507/#509 and rejected backend PR #44 were excluded from
this release. Scheduled autonomous development remains paused.

## Entry template

Copy this structure for the next meaningful update; remove unused fields.

```markdown
## YYYY-MM-DD — Short description

**Request / reason:** ...
**Change / decision:** ...
**References:** PR, commit, issue, runbook, or CI links.
**Verification:** commands/results, tested revision, and fixture/live scope.
**Status:** prepared / merged / deployed / blocked (state the target/revision).
**Next / limitations:** concrete remaining step, risk or required decision.
```

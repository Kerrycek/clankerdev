# Verification, readiness and release evidence

Requirements: REQ-039, 042–046, 056–065. Documentation coverage, implemented code,
passing fixtures and production readiness are separate claims.

## Evidence levels

| Level | Proves | Does not prove |
| --- | --- | --- |
| Source inspection | Route/adapter/guard exists at a revision; request shape can be reviewed. | Deployed API accepts it or UI works in a browser. |
| Unit/script/BFF tests | Tested model, guard, serialization, server and script contracts. | End-to-end deployed workflow. |
| Fixture Playwright | Rendering, interaction, request expectations against synthetic intercepted responses. | Backend ordering, actual permissions/mutations or real DNS/restore outcomes. |
| Real isolated API/VM | Exact workflow against pinned backend with synthetic objects and receipts. | Every other workflow, another revision, or shared production state. |
| Anonymous deployed checks | Build provenance, public pages, endpoint routing, selected auth/health properties. | Logged-in member/admin lifecycle certification. |
| Human review/audit | Scoped UX/security/code conclusions with named reviewer and findings. | Unreviewed areas or permanent freedom from defects. |

Evidence records need date, commit/tree, API revision when relevant, environment,
command/scenario, role, locale, viewport, data origin, result, artifacts and limits.
For mutations include object ownership, acceptance/action-state IDs, final state
and cleanup receipt. Do not rerun completed destructive scenarios blindly.

## Repeatable checks

Use the supported Node range in [package.json](../../package.json), with the locked
npm dependencies. The current baseline supports Node ^20.19, ^22.12 or >=24.

```sh
npm ci
npm ci --prefix bff
npm run ci:pr
npm run build
npm run e2e:pr
npm run audit:design-docs
```

`ci:pr` includes static checks, i18n/CSP, typecheck and unit/script/BFF suites.
PR Playwright uses deterministic fixtures. Inspect [workflows](../../.github/workflows)
and [Playwright config](../../playwright.config.ts) for exact current selection,
projects, timeouts and artifacts. Broad/nightly checks and optional audits are
separate from the PR selection; do not assume every npm audit script runs in CI.
Use focused tests during a small change, and an integrated candidate before a
multi-PR release. Repeat the full suite only for relevant changes or new failures.

`npm run docs:inventory` regenerates route/API inventory; `audit:design-docs`
checks it and local handbook links/requirement IDs. These are documentation
consistency checks, not a substitute for semantic review or backend tests.

## Recorded release evidence (2026-09-27)

Latest recorded deployment: [PR527 receipt](../work-log/2026-09-27-per-change-work-log.md),
UI/BFF `156a7c04`, previous `e7ce3d73`, both hosts. The older release below is
retained as historical evidence. The [requirement matrix](EVIDENCE_MATRIX.md)
identifies concrete verification entry points and unverified conditions.

The [work log](../work-log/2026-09-27-preferences-console-deletion-release.md) records release `fd290b5e` (PR517–520), including
exact counts and limitations. Its integrated tree passed unit/script/BFF/static
checks, 681 full PR fixture cases and targeted Chromium/WebKit checks. Post-deploy
browser cases still used synthetic API fixtures; actual anonymous provenance,
health/session/auth routing checks also passed. These facts do not certify a live
VPS deletion simply because a delete dialog fixture passed.

Historical failed run [36274080869](https://github.com/Kerrycek/clankerdev/actions/runs/36274080869)
was superseded by [successful 36276637276](https://github.com/Kerrycek/clankerdev/actions/runs/36276637276)
after correcting exact settings-PUT test guards. Preserve the failed history and
fix the expectation for the real contract; never remove protection to get green.

Earlier isolated VM evidence is recorded for auth/MFA/sessions, VPS, DNS publication,
local/remote restore and a scoped user-data scenario. Full local artifacts have not
all been transferred into public durable CI storage. Reconcile receipts and pins
before reuse; do not present them as a fresh exact-candidate certification.

## Beta acceptance checklist

This replaces percent-based readiness claims. Each unchecked gate needs a named
review owner and a durable evidence link before closing it.

- [x] Reviewable deployed frontend/BFF baseline and previous rollback revision
  recorded for the 2026-09-27 release (not an approval for the next release).
- [x] Existing release fixture/static evidence identified and scoped honestly.
- [ ] User-data, IP history and dataset/snapshot contracts resolved on the selected
  API; rejected backend proposal/dependent PR status explicitly decided.
- [ ] Adversarial multipage matrix complete for each affected collection: IDs,
  timestamps/ties, owner scope, errors, end, reload/back, no loss/duplication.
- [ ] Full admin application/account lifecycle certified against the exact isolated
  UI/API candidate, including permissions, failed requests, persisted state and cleanup.
- [ ] Dev soft-delete default retention chosen and verified through an authorized
  configuration change, or explicitly excluded from the beta's supported scope.
- [ ] Mobile error-toast/Cancel overlap resolved and checked in cs/en.
- [ ] Live audit consumers of session.json match sessionKey/expiry contract while
  retaining origin/security checks.
- [ ] Prior real auth/MFA/session, VPS, DNS publication and local/remote restore
  receipts reconciled against candidate changes; revalidate affected paths only.
- [ ] KB minimum has current page bindings, reviewed text and real cs/en captures
  with independent pins; publication/cutover policy agreed.
- [ ] Current candidate reviewed on member/admin, desktop/mobile, cs/en and both
  themes; pending visual PRs are not mistaken for already-deployed behavior.
- [ ] Independent code/security audit scope, reviewer, findings and dispositions recorded.
- [ ] Handover owner has source, docs, private operational access transfer, validated
  rollback runbook and known limitations; explicit release authorization recorded.

## Required high-value regression matrix

| Area | Scenarios |
| --- | --- |
| Auth/session | anonymous endpoints, login/failure, MFA/passkeys, idle expiry, token rotation across tabs, reload, logout races, persistence after login |
| Permissions | owner vs other owner, admin My vs admin view, support capability restrictions, direct routes, API denial |
| Mutations | valid/invalid draft, rejection in dialog, acceptance receipt, failed chain, missing receipt, lost response, reload/tab locks, reconciliation |
| VPS/storage | creation late defaults, compute/disk overrides, console entry/revoke, soft/hard/retention, snapshot/restore/replication and cleanup |
| Requests | current/resolved states, orphaned owner, risk unknown/high, correction token, approve/reject/ignore/correction, queue and retained errors |
| DNS | record validation, secret handling, permission failure, transaction and actual published response |
| Navigation | active route, keyboard focus, mobile drawer, compact labels, long names, localization, back/forward/query state |

## Reporting a failure

Record sanitized reproduction, exact revision/environment, expected vs actual,
first failing boundary and whether a mutation may have been accepted. Preserve
trace/receipt privately if it contains data. Investigate test drift versus product
regression; do not dismiss a failure based solely on another passing run. A passing
retry is not automatically a resolved race. Update the requirement/work log with
the limitation and evidence needed to close it.

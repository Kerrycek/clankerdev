# Beta candidate — 24 September 2026

This is a local integration candidate, not an approved release or a deployed
build. The product remains the user/admin interface. Validation below must not
be interpreted as live API certification.

## Inputs

Base: `fbb02a065bc65f50f66f5bbcedfc35099a74bfa0`.
Initial four-PR integration: `141b92281a232c4c07a73a2c475ef93eba457b60`.

| PR | Head | Behavior |
| --- | --- | --- |
| [493](https://github.com/Kerrycek/clankerdev/pull/493) | `69f069d8fae09ef015343c438ff10048d9bce567` | Member node history and admin configuration |
| [494](https://github.com/Kerrycek/clankerdev/pull/494) | `0ba1b61327c54737df35663e15df186230b07c59` | Registration risk beside the decision and map layout |
| [495](https://github.com/Kerrycek/clankerdev/pull/495) | `236e1d2701968817ec79901007b9b05b8f31caf4` | vpsAdmin first in browser titles |
| [496](https://github.com/Kerrycek/clankerdev/pull/496) | `67b0c2d3db9aa8e2f8c0b3e2091ecd1443f9c8aa` | Supported user-data filters, bounded search and cursor navigation |
| [497](https://github.com/Kerrycek/clankerdev/pull/497) | `ff4529c3f6fea1d61d3a1d41502c0b028ce311e2` | Preserve backup tab/filter edits during overlapping navigation |

PR493–496 have successful static/unit and smoke CI. PR497's new CI is pending;
human review is still outstanding. Excluded PRs #242, #435 and #433 are not included.

## Beta gates

- [x] Integrate the four initial heads and the subsequent backup fix locally.
- [x] Lint, i18n/CSP audits and typecheck on the combined code.
- [x] 128 script tests and 24 BFF tests pass on the combined code.
- [x] All 1,452 unit tests and production build pass after including PR497.
- [x] Complete combined desktop/mobile Playwright fixture regression, including PR497.
- [ ] Verify critical login/session, VPS, DNS, storage/backup and admin workflows
  against an isolated actual API with synthetic member/admin accounts.
- [ ] Establish server ordering for user-data; the frontend cannot prove absence
  of omitted rows from an unordered server result. See
  [user-data contract](../contracts/user-data-pagination.md).
- [ ] Agree and apply the IP history server/client cursor contract, including
  tied timestamps, scope, invalid cursor errors and the terminal page.
- [ ] Audit remaining dataset/snapshot cursor contracts from #189.
- [ ] Produce actual cs/en VPS KB screenshots and verified navigation with
  independently recorded UI/API pins.
- [ ] Complete human review and obtain approval for a concrete deployment.

## Evidence and limits

The local evidence bundle is `clankerdev-beta-20260924`: candidate-ci.log
(lint/audits/typecheck/script checks), candidate-bff.log, candidate-unit.log,
candidate-build.log and candidate-playwright.log. The initial ci:pr attempt
stopped because the new worktree lacked BFF dependencies. After attaching the
same locked dependencies used by the original worktree, the 24 BFF tests and
full unit suite passed. No product code or checks were bypassed for this.
After PR497, candidate-unit-with-backup-fix.log records all 1,452 tests passing
and candidate-build-with-backup-fix.log records the successful final code build.

The initial combined smoke set passed 218 desktop and 77 mobile cases, with
one intentionally mobile-only case skipped on desktop. The additional desktop
PR-tagged set passed 279 and exposed one existing backup navigation race.
PR497 fixes that race; both deterministic interaction-order tests fail on main
and pass after the fix. Its standalone validation passed 16 component and 18
desktop/mobile browser cases, typecheck/lint/build. The combined candidate is
finished the remaining 241 mobile cases and the affected 9 desktop backup cases
successfully. The original failing case passes on the corrected combined code.
The union of smoke and PR-tagged selections covers 498 desktop and 318 mobile
passing cases; the 9-case final backup run repeats 7 of those and adds 2 further
desktop checks. One intentionally mobile-only case is skipped on desktop.

Playwright uses deterministic API fixtures. Live map-provider tests from #494
do not constitute a live authenticated API workflow. Structural audit debt on
unchanged main remains open (62 files above 500 lines versus budget 53, plus
existing cast findings); this candidate does not reset those budgets.

A separate local backend proposal, `de1cf7b06fabe7dd4aa89563b97762d40407d494`
against API `486350466`, passed 32 IP-history and 10 user-data Index specs using
its own MariaDB. It is not part of this candidate, not pushed upstream, and not
deployed. The proposed chronological cursor requires a corresponding UI change.

KB preparation has built immutable UI/BFF packages for PR #496's head and
started building a private VM baseline. The packages are not yet wired into
that cluster, and the KB package pin is not this combined candidate. Existing
legacy KB screenshots cannot serve as evidence for the new UI.

## Deployment and rollback boundaries

Deploy only after the remaining gates and explicit approval of an exact artifact.
Before deployment, record each host's current release and frontend/BFF links,
retain the previous artifact, and validate its public auth/config endpoints.
Roll back frontend and BFF together to that recorded release if smoke fails.
At candidate preparation time both shared UI deployments remain on `fbb02a06`.

Keep backend promotion separate: this candidate contains no database migration
and does not authorize an API update. Do not deploy a UI that depends on a new
cursor contract until the target API supports that exact contract. Production
KB publication likewise requires its own reviewed bilingual candidate and approval.

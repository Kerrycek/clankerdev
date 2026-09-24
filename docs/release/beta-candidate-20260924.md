# Beta candidate — 24 September 2026

This is a local integration candidate, not an approved release or a deployed
build. The product remains the user/admin interface. Fixture regression and
the first isolated VM checks are reported separately below.

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
| [498](https://github.com/Kerrycek/clankerdev/pull/498) | `4d9cb3f1f045379645dbc52d9b083f616e5a8f87` | Preserve resource choices when asynchronous VPS defaults arrive |
| [499](https://github.com/Kerrycek/clankerdev/pull/499) | `7c798b332a8edbaa8e5c017031c1e39edb3bb7d2` | Register passkeys on the authentication origin through the BFF |

PR493–498 have successful static/unit and smoke CI; human review is still
outstanding. Excluded PRs #242, #435 and #433 are not included.

## Beta gates

- [x] Integrate PR493–498 locally on the candidate branch.
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
- [x] Audit dataset/snapshot cursor source contracts from #189; see
  [remaining mismatches](../contracts/dataset-snapshot-pagination.md).
- [x] Reproduce all three #189 ordering failures against real Ruby API/MariaDB
  and prepare a tested local tuple-cursor proposal (`ee81404ca`).
- [ ] Agree and apply those contracts to API/UI and verify actual browser
  multi-page traversal against the exact isolated API pin.
- [x] Produce initial actual cs/en VPS list/detail screenshots and navigation
  with independent UI/API pins (prototype evidence, not publication assets).
- [x] Verify corrected resource submission and persisted values on the pinned VM.
- [x] Verify actual member/admin node-history access, foreign VPS denial and logout
  in Czech and English on desktop and mobile layouts on the pinned VM.
- [x] Verify actual DNS zone/record CRUD and snapshot create/delete on cs/en
  desktop/mobile, including persisted reads and completed snapshot transactions.
- [x] Verify local snapshot data restoration through the UI in cs/en desktop/mobile.
- [x] Verify server session revocation, protected-content removal and real
  reauthentication in cs/en desktop/mobile with two independent OAuth sessions.
- [x] Verify TOTP enrollment, password-only challenge, invalid/valid codes and
  fixture cleanup against real OAuth in cs/en desktop/mobile.
- [x] Fix confirmed WebAuthn registration origin mismatch and verify enrollment
  and login with a browser virtual authenticator; see [actual reproduction and existing hosted contract](../contracts/webauthn-registration-origin.md).
- [ ] Verify timed session expiry/token refresh and recovery codes.
- [ ] Verify DNS server publication, backup replication and remote restore.
- [ ] Expand KB navigation contracts/fixtures and remaining live workflow coverage.
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

The isolated KB cluster booted successfully on its own local/socket networks
and private Nix store. Actual OAuth login as fixture member `test-user1`, sidebar
navigation, VPS list and detail passed in cs/en on UI `93b600c2` / API `486350466`.
The create operation produced a running fixture VPS (ID 1, documentation-range
addresses), with transaction completion shown in the real UI. Four prototype
PNGs and per-image SHA/UI/API provenance are in `live-vm/{cs,en}` in the evidence
bundle. They do not replace the legacy KB inventory or authorize publication.
KB branch `codex/clankerdev-kb` at `f956b54` contains the runner and guarded
fixture preparation; pinned `bin/check` passes, retaining all 120 legacy PNGs.

That real create exposed a resource-default race: entered 1 CPU / 1 GiB / 10 GiB
became 8 CPU / 4 GiB / 120 GiB while defaults loaded. PR498 preserves manual and
preset choices. Both new delayed-default regressions fail on main and pass with
the fix; they also cover refetches and untouched network defaults. Standalone
PR498 validation: 1,429 unit, 128 script and 24 BFF checks, lint/typecheck/i18n/CSP,
production build and 34 desktop/mobile VPS-create fixture browser cases PASS.
After integrating PR498, all 1,454 combined unit tests and typecheck pass.
The previous combined 818 browser cases are not relabeled as tests of PR498.
The own services VM was updated successfully to UI `22cf9910` / API `486350466`.
A second dedicated fixture VPS (ID 2, `kb-resources.example.test`) was created
through the actual UI. The POST body and subsequent API GET agree on 1 CPU,
1024 MiB memory, 10240 MiB disk and zero swap. The VPS is running; its create
transaction completed 14/14 steps. New cs/en list/detail PNGs, hashes, resource
assertions and the durable creation receipt are in `live-vm-resource-fix/`.
Earlier images remain preserved with their original UI revision.

Real OAuth sessions for member, other member and admin passed in cs/en:
member kernel-history navigation and API, private node configuration denied
without fetching private resources, foreign VPS rejected by the actual API,
admin kernel parameters/software API, and logout clearing the server session.
`access-cs.json`, `access-en.json` and the two `access-mobile-*.json` files
record those results and both immutable pins. Mobile runs use a 390×844 viewport
and actual drawer navigation. These checks do not certify MFA, expiry/renewal,
the full admin workflow set. DNS and snapshot operations were subsequently
verified as described below; backup replication and restore remain open.

Actual DNS and storage checks on the same pins are recorded in
`live-dns-storage/`: four `dns-*.json` and four `storage-*.json` receipts plus
logs, for Czech/English and desktop/390×844 mobile. DNS creates a dedicated
example.test zone and documentation-range A record, edits the address, verifies
it after reload, deletes the record/zone, and confirms the zone is inaccessible.
All five mutations per variant return HTTP 200 and API success. The isolated
cluster has DNS servers disabled, so this proves API/UI persistence and lifecycle,
not authoritative DNS publication or resolution.

The storage path follows the existing fixture VPS through Storage to its root
dataset and Snapshots. Each variant creates a labeled snapshot, observes a
successful finished action state, reloads the saved snapshot, deletes it, observes
a successful finished delete action, and confirms absence in a fresh API list.
Durable receipts prevent duplicate mutations after an uncertain result. Only
these fixture snapshots are removed; the VPS and its data remain. This does not
prove data restore, backup scheduling or replication to another node.

The subsequent `restore-*.json` receipts and logs in `live-restore/` cover
actual local data restoration in all four locale/layout combinations. A guarded
helper verifies the container ID and hostname, writes a dedicated synthetic
marker, and reads it back inside fixture VPS 2. The UI creates a snapshot, the
helper changes the marker, and the UI confirms rollback by typing the snapshot
label. Each restore action completes successfully (4/4 steps), and the marker
returns to its original content inside the restarted VPS. The helper removes
only its marker; the UI deletes its snapshot and a fresh API list confirms
cleanup. The runner refuses to roll back when other snapshots are present.
This verifies local snapshot restoration, not backup replication or recovery
from a remote-only snapshot. No shared VPS or user data participates.

The `live-session/` evidence covers four actual OAuth session-revocation runs
(cs/en, desktop 1440x1100 and mobile 390x844). A second independently logged-in
browser session closes the first through the profile UI. The revoked session
receives API HTTP 401, redirects to the public expiry notice, and displays no
protected shell or VPS list. The controller session remains valid; a new real
login creates a different session. Tests use only `test-user2@example.test`
in the isolated cluster. Session IDs are recorded; tokens, fragments, login
screens and traces are not stored. This exercises server revocation, not
clock-driven expiry, refresh-token rotation or MFA.

KB runner commit `e8c93d4a38e77ec7e454d3283036b4e3e96213dd` adds
`bin/capture --ui clankerdev --scenario session` with optional `--mobile`.
The pinned `bin/check` passed and the 120 legacy PNGs remain unchanged.
UI/API pins remain `22cf9910` / `486350466`.

The `live-mfa/` evidence covers TOTP enrollment and login in the same four
locale/layout combinations, using `test-user2@example.test`. The UI creates and
confirms a temporary device, a fresh browser requires a second factor after
password entry, an invalid code is rejected, and a valid code completes OAuth.
Each final receipt confirms device deletion and restoration of the original
MFA master flag. No provisioning secret, QR, recovery code, screenshot or trace
is saved. This does not certify WebAuthn or recovery-code behavior.

The first harness attempt passed the authentication checks but failed during
logout/cleanup. Its temporary device was already deleted; the master flag was
restored through the isolated fixture admin UI. The harness now handles the
MFA-disable confirmation dialog explicitly and defers logout until after
cleanup. All four final runs completed with cleanup; initial failure and
reconciliation logs remain in the bundle. Runner commit
`9ea64f73e068f1330cdede72dda10689f19158bb` adds `--scenario mfa` and passes the
pinned `bin/check`, including a public TOTP test vector. Legacy PNGs and tested
UI/API revisions are unchanged.

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


## Hosted WebAuthn correction — PR499

Integrated runtime pin `e50b8e70ec659659f6d2898d2fe1a72f9953ef5f` adds PR499 to
PR493–498. The isolated API remains `486350466`. No shared deployment occurred.
The combined candidate passed 1,454 unit tests, 28 BFF tests and typecheck;
PR499 standalone passed ci:pr (1,427 unit, 131 script, 28 BFF), build and six
new fixture Playwright tests across cs/en desktop/mobile.

The updated own VM passed four real WebAuthn workflow variants: cs/en on desktop
and mobile. They verify effective nginx+BFF CSP, a localized handoff, hosted
cancellation, clean return URLs, enrollment on the authentication origin,
a fresh API credential list, password-only MFA challenge, passkey authentication
in a separate OAuth context, deletion of the fixture credential, and restoration
of the account's original MFA setting. Key material stays only in browser/test
memory; no provisioning screenshots or traces are recorded. This uses a browser
virtual authenticator and does not certify physical hardware. The provider's
registration page remains English, as explained on the bilingual handoff.

Evidence is in `passkey-fix/live/webauthn-{desktop,mobile}-{cs,en}.json` and logs.
Two initial harness attempts registered successfully but could not read the
finish response body after the immediate cross-origin redirect. Their exact
fixture keys (2 and 3) were reconciled and deleted before retrying. Final tests
verify persisted API state and actual subsequent authentication rather than
relying on that discarded body; keys 4–7 were removed by normal test cleanup.
An initial nginx build failed its header-inheritance audit; explicit policy
forwarding resolved it with the audit retained. Final KB `bin/check` passed;
the existing 60 concepts and 120 legacy PNGs were unchanged.

Earlier unrelated workflow receipts retain their original UI pins. This section
does not re-label those checks as executions against the new runtime pin.

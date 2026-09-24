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
| [500](https://github.com/Kerrycek/clankerdev/pull/500) | `2fa71fe9bdd35781bb4c03acae2b445f28a1bad5` | Serialize BFF session refresh and logout through persistence |
| [501](https://github.com/Kerrycek/clankerdev/pull/501) | `116737117996d72080659f34ef2d6809e92b86ba` | Preserve open tabs across OAuth rotation; reads retry once, writes require explicit resubmission |

PR493–501 have successful static/unit and smoke CI on their current heads. Human review is still
outstanding. Excluded PRs #242, #435 and #433 are not included.

## Beta gates

- [x] Integrate PR493–501 locally on the candidate branch.
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
- [x] Verify real API auto-renewal, idle expiry and BFF bootstrap refresh in
  cs/en desktop/mobile.
- [x] Verify recovery-code login, disabled-factor replay rejection and remaining
  TOTP-factor login in cs/en desktop/mobile.
- [x] Fix [confirmed concurrent BFF refresh](../contracts/bff-concurrent-refresh.md):
  actual API token validation and deterministic failure/logout race regressions.
- [x] Verify expired-refresh failure and real BFF cookie/store expiry in
  cs/en desktop/mobile with short isolated test lifetimes and full restoration.
- [x] Verify request-triggered recovery in an already-open SPA after rotation
  by another tab: read retry and preserved write forms with explicit resubmission.
- [x] Complete updated combined static/unit/build and desktop/mobile smoke
  regression after the auth transport changes in PR499–501.
- [x] Verify DNS publication on both authoritative servers in cs/en desktop/mobile.
- [x] Verify backup replication and remote restore in cs/en desktop/mobile,
  including backup-only snapshot placement, restored content and fixture cleanup.
- [x] Verify prototype member kernel/system-history navigation contracts and
  actual cs/en desktop/mobile screenshots, preserving semantic control IDs.
- [ ] Expand remaining KB navigation/page bindings and live workflow coverage.
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

## Timed expiry and recovery codes

On runtime UI `e50b8e70` / API `486350466`, all four cs/en desktop/mobile
variants pass each of the following real Playwright workflows:

- A 20-second renewable API token remains valid during 30 seconds of actual
  requests, expires after 25 seconds of genuine inactivity, and produces an
  API 401, localized expiry notice and removal of protected UI content.
- With the dedicated fixture OAuth client temporarily configured for fixed
  75-second tokens, bootstrap refresh rotates the access token; the old token
  returns 401 and the new token returns the same user successfully.
- Two TOTP devices are enrolled. The first device's recovery code completes
  actual OAuth login and disables that device while the other remains active.
  Reusing the code in a fresh challenge is rejected, and the remaining TOTP
  device still authenticates. Both temporary devices are deleted and the
  original account MFA flag is restored.

All runs restore and verify the dedicated OAuth client's original settings.
Secrets stay in memory; no provisioning screenshots, traces or token dumps
are recorded. Recovery replay is verified while its device remains disabled;
this does not assert permanent invalidation after manually re-enabling it.
BFF cookie expiry, expired-refresh failures, continuously open SPA renewal and
concurrent refresh remain separate gates.

Evidence: `session-gates/expiry-*.json`, `recovery-*.json` and matching logs.
One mobile English expiry run completed all assertions and restoration, then
hit a proxy socket reset during teardown. The harness now handles early socket
errors with a regression test; rerunning its completed receipt exits cleanly
without repeating mutations. An initial mobile Czech recovery attempt timed
out before completing replay verification; cleanup succeeded. The retry with
finer stage diagnostics and a longer MFA-challenge wait passed, as did mobile
English. The initial failure remains in the evidence bundle; its cause is not
asserted to be a product defect.

KB runner commit `c6ffc2390c97157945a0b14762c470b35e26cf82` is present in both
own checkouts. Pinned `bin/check` passes with 60 concepts and 120 legacy PNGs
unchanged. No upstream KB push or publication was performed.

A further actual-API concurrency probe found a new refresh-enabled defect:
eight parallel BFF requests returned tokens, but seven immediately failed API
validation with 401. The later stored token remained valid. This gate remains
open; see the [reproduction and fix requirements](../contracts/bff-concurrent-refresh.md).

## Concurrent BFF refresh correction — PR500

Integrated runtime pin `4a3ea18b1870a86ab47c48e4a3ffa45c37248d0c` adds PR500.
The isolated API stays `486350466`. Its Nix production UI/BFF build and all
35 integrated BFF tests pass. Standalone checks passed 1,427 unit, 128 script
and final 31 BFF tests plus lint, i18n/CSP and typecheck. Three concurrency
regressions fail with the queue disabled.

Four actual Playwright variants pass (cs/en desktop/mobile): eight parallel
bootstraps plus passkey handoff return the same valid token; all nine API
validations return 200. Logout makes the latest token return 401 and leaves
the BFF session anonymous. Every run restores the dedicated OAuth client.
Receipts and logs are in `session-fix/`; earlier failed probes retain their
original pin under `session-gates/`. The earlier failure is corrected by this
candidate, not erased from the evidence.

KB branch `7658225` contains the guarded refresh runner, independent UI/API
pins and updated BFF dependency hash. Pinned `bin/check` passes with 60 concepts
and 120 existing PNGs unchanged. The queue is process-local: one BFF process
must own each file store. Open-SPA renewal, BFF cookie expiry, expired-refresh
failure on the actual API and the remaining beta gates are still open.

PR500 static/unit and smoke CI pass; smoke completed on 24 September at 04:40 UTC.
Human review remains outstanding. No shared service was deployed or PR merged.

## Remaining expiry paths verified against the actual API

Eight additional Playwright workflows pass on UI `4a3ea18b` / API `486350466`:
expired refresh and BFF cookie expiry, each in cs/en desktop/mobile. No product
code or API changes were needed. KB runner revision is `4952b54`.

For expired refresh, the dedicated OAuth client temporarily issues a 75-second
access token and a 10-second refresh token. After 20 real seconds the access
token still validates, but attempted renewal clears the BFF session. A protected
route shows login-required content without the authenticated shell. Subsequent
real OAuth authorization, including valid provider SSO where available, returns
a different token for the same user. The original client settings are restored
and verified in every variant.

For cookie expiry, a guarded runtime override sets only the dedicated VM's BFF
lifetime to 30 seconds. After 35 real seconds the browser cookie is gone; even
replaying the original signed cookie with valid same-origin metadata yields an
anonymous BFF response. The protected route denies access, and a new OAuth
login succeeds. The API token has an independent lifetime and still validates
before cleanup; the runner explicitly closes its recorded fixture session and
verifies that token now returns 401.

The driver removes only its marked runtime override and restarts the own BFF
in an exit trap, including on failed attempts. Final service checks confirm the
override is absent. A further actual OAuth login verifies the default 30-day
BFF lifetime has returned. This is real-time coverage with a short test setting,
not a claim that a browser was observed for 30 days. Shared services, session
signing secrets and the actual API pin remain unchanged.

Evidence is `auth-expiry/`: eight final receipts and logs, driver/restoration
proof, fresh default-lifetime proof, and the final pinned KB check. An initial
refresh test incorrectly waited for a password form after successful provider
SSO; the runner now accepts both supported authorization paths. Cookie harness
attempts exposed a wrong cleanup verb (correct API operation is POST) and
missing Origin on the explicit cookie replay. Their records remain preserved;
fixture session 145 was reconciled and closed, subsequent cleanup succeeded.
None of these harness errors is reported as a product defect.

Pinned `bin/check` passes and retains 60 concepts and 120 legacy PNGs. Earlier
receipts retain their own runtime pins. Open-SPA token renewal, remaining DNS/
backup/KB workflows, API cursor agreement and human release review remain open.

## Open-tab read recovery — PR501

Integrated runtime `80956b440bd9df29b4fa29393cbccef077d6d4b7` adds
[PR501](https://github.com/Kerrycek/clankerdev/pull/501) to PR493–500.
The API remains `486350466`. The prior runtime `4a3ea18b1` reproduced a real
regression: a later token rotation in tab two caused tab one to reload its
entire document after an API 401. Its in-memory marker was lost. The retained
baseline receipt says `regressionConfirmed: true`; diagnostic completion is
not a passing beta gate. Its mutable event arrays also include cleanup events.

The correction exposes a non-credential BFF session fingerprint and permits
one bounded recovery/retry for GET/OPTIONS only, for the same session. See
[the contract and limits](../contracts/open-tab-oauth-refresh.md).

All four actual Playwright variants now pass (cs/en, desktop/mobile), with
real OAuth login, 20 seconds of elapsed time and a later second-tab rotation.
The original token returns 401 and the replacement returns 200. The original
SPA keeps its marker, emits no document navigation, reaches the DNS route and
sends successful API reads using the replacement token. Logout revokes that
token and clears the BFF session. Each run verifies restoration of the owned
OAuth client's original settings. No synthetic 401s, token injection or
production data are used. Evidence is `open-tab-refresh/`, with exact pins in
every receipt, original baseline, four final receipts, logs and runner/driver.

Standalone validation: 1,445 unit, 128 script and 25 BFF tests, lint, i18n/CSP,
typecheck and production build. Integrated targeted validation: 43 unit tests,
36 BFF tests and typecheck, followed by successful Nix UI/BFF/services build.

This closes the read-recovery gate, not continuous renewal. A write as the
first request after rotation still uses existing expiry handling; writes are
never automatically replayed. Further work must preserve that safety property.
Other remaining gates include authoritative DNS publication, remote backup
replication/restore, KB navigation minimum, backend cursor agreement and human
release review. No PR was merged, shared service deployed or upstream PR opened.


## Mutation-first recovery — PR501 follow-up

Integrated runtime `eccbcc9202301ca3fdd9b529818f5edfeee9c9f0` / API `486350466`
adds form preservation for the first rejected write after rotation. The prior
runtime `80956b440` reproduced one DNS POST 401 followed by document reload
and lost fields. This baseline is retained separately, not counted as a pass.

Four final actual Playwright variants pass (cs/en, desktop/mobile): the original
tab still holds the old token at submission; one POST receives 401. The form,
its values and document marker survive, and a localized message asks the user
to submit again. No second POST occurs automatically. A second click sends one
matching request, returns 200 and persists a zone with the expected name and
fixture owner. Logout revokes the latest token. Zones 6, 7, 9 and 10 are deleted,
absence checked, and the dedicated OAuth client restored in every variant.
These DNS operations do not verify authoritative DNS publication.

Evidence is `mutation-refresh/`. The initial desktop Czech harness compared a
zone name without the API's canonical trailing dot; the same comparison made
its first cleanup flag unreliable. The recorded zone 5 was subsequently checked
by exact normalized name and owner 3, deleted, and confirmed inaccessible. Its
failure and separate reconciliation proof remain preserved. The runner now
normalizes the terminal dot for preflight, readback and cleanup.

An initial mobile Czech attempt passed form/resubmission checks but failed
during logout with a Playwright Error. Its exact cause is unconfirmed. Added
waiting for the actual created-zone UI plus more precise failure stages; the
fresh mobile retry passed. Zone 8 and client settings were cleaned in that
initial attempt. Already-complete desktop receipts were preserved and skipped.
No product defect is inferred from either harness failure.

Local validation: full ci:pr with 1,450 unit, 128 script and 25 BFF tests;
24 final focused transport tests additionally cover a mixed read/write case.
Integrated targeted validation: 49 unit and 36 BFF tests, typecheck, and the
Nix UI/BFF/services build. Final pinned KB check passes 60 concepts and 120
existing PNGs. Older live receipts retain their own source pins. Broader
combined regression is the next verification step; backend cursor agreement,
DNS publication, remote backup/restore, KB minimum and human approval remain
open. No shared service was deployed and no PR was merged.

## Combined regression after PR499–501

Candidate `5655aa501f26617fe4242fba14db842dabff975f` passed `npm run ci:pr`
(1,478 unit, 131 script and 36 BFF tests plus lint, audits and typecheck),
production build, and `npm run e2e:broad`: 218 desktop and 77 mobile passes,
with no retries. One intentionally mobile-only outage layout case was skipped
in the desktop project; a separate targeted mobile run passed that case.
These are fixture API tests, not actual VM evidence or the entire E2E suite.
No failures occurred. The current PR493–501 static and smoke checks are also
successful; human review is still outstanding.

Logs: `combined-regression/clanker-beta-combined-20260924.log` and
`combined-regression/clanker-beta-outage-mobile.log` in the local evidence bundle.
Actual VM receipts retain their exact older runtime pins; a docs-only commit
does not change their provenance.

## KB member-history navigation prototype

The separate KB branch now declares `node.kernel-history` and
`node.system-history` for the new UI, retaining the legacy semantic control IDs
while checking the actual React routes and cs/en labels. The contract pins UI
`eccbcc9202301ca3fdd9b529818f5edfeee9c9f0` and API
`486350466e8fb6f966add1cde3fa2bc12b4d6b62` independently and rejects source,
label, pin, duplicated-ID and member-route drift. Whole-file source fingerprints
are intentionally conservative; every changed fingerprint needs impact review.

Four real VM variants pass, covering two paths each: member OAuth login, visible
sidebar/drawer node navigation, semantic tab labels and URLs, active state,
populated API-backed history, absence of admin controls/private requests and
logout. Eight cropped PNGs with hashes and contract digests are saved in
`navigation/`. Representative desktop/mobile images in both languages were
visually checked. Only synthetic fixture data is shown.

The first desktop Czech harness used a non-prefixed API path and assumed that
system history was a nested endpoint. Its failed receipt and log are retained;
logout completed. The corrected runner follows the actual client endpoint and
checks the node filter on `/node_system_states`. All four fresh variants pass.
No product changes were required. Pinned KB `bin/check` passes, including drift
rejection tests and the unchanged 60-concept/120-PNG legacy inventory.

This is a separately validated prototype, not a replacement for the production
wiki navigation contract or a publication-ready page migration. Remaining page
bindings, bilingual article review, broader workflows and publication approval
still apply. No upstream KB push or production publication occurred.


## Authoritative DNS publication — 24 September, 09:24 UTC

All four actual Playwright workflows passed on UI
`eccbcc9202301ca3fdd9b529818f5edfeee9c9f0` / API
`486350466e8fb6f966add1cde3fa2bc12b4d6b62`: cs/en at 1440×1100 and 390×844.
The fixture member logged in through OAuth and created, edited and deleted
DNS records through the UI. Direct non-recursive queries to both isolated
servers verified the authoritative SOA, initial A value, edited A value,
record absence and zone removal. All 20 UI mutations returned API success;
all four zones (IDs 13–16) became inaccessible and sessions were logged out.
Forty server observations are retained in the four immutable-pin receipts
under `clankerdev-beta-20260924/dns-publication/`, alongside the execution,
build and readiness logs. No API fixtures or intercepted DNS responses were used.

KB commits `7cb59f7` and `8ac4466` corrected DNS node location mapping in the
Nix configuration and production-shape seed: daemon identity and supervisor
queues now both use `.prg`. The pinned KB checks passed; the final module
follow-up passed Nix parsing/topology checks, Nix build and actual registration
against API node status. The existing-cluster initialization needed only new
DNS broker accounts and a supervisor restart after seeding. This affected only
the dedicated cluster. The temporary `.lab` accounts were removed after confirming that no
connection used them. The product UI/API pins did not change.

This closes authoritative DNS lifecycle publication. It does not certify
external delegation, DNSSEC, public resolvers, remote backup replication or
restore. Human review, outstanding API cursor contracts and remaining KB/admin
coverage retain their separate open gates. No shared service deployment or
upstream PR was performed.


### Actual remote backup restoration — 24 September

All four cs/en desktop/mobile Playwright workflows passed on UI
`eccbcc9202301ca3fdd9b529818f5edfeee9c9f0` / API
`486350466e8fb6f966add1cde3fa2bc12b4d6b62`. KB branch implementation is
`51fcab874cc701fe5941f97614d63abdf679daa7`, local and synced to the owned
isolated runner; no upstream KB publication is implied.

Each fixture member created two snapshots through the actual UI. Native
replication transferred them to the separate backup node and retention removed
the older primary copy. Both API-model placement and actual ZFS inventory
confirmed that the selected snapshot existed only on the backup before the
member invoked UI rollback. Every restore completed successful Send on node
201 and Recv/PrepareRollback/ApplyRollback on node 101, then returned the
synthetic file to its original content. These are actual remote transfers,
independent of the earlier local-rollback evidence.

| Variant | Dataset | UI snapshots | Native replication | UI restore | Native cleanup |
| --- | --- | --- | --- | --- | --- |
| desktop cs | 5 | 9, 10 | 276 | 277 | 278, 279 |
| desktop en | 6 | 11, 12 | 283 | 284 | 285, 286 |
| mobile cs | 7 | 13, 14 | 290 | 291 | 292, 293 |
| mobile en | 8 | 15, 16 | 297 | 298 | 299, 300 |

All sessions logged out. All four dedicated datasets, their snapshots and pool
copies are absent from the database; their source/backup filesystems are absent
from ZFS. The original fixture VPS and pools are preserved. The two new empty
pools remain owned fixture infrastructure. Replication, retention and cleanup
are native fixture operations; only snapshot creation and rollback are claimed
as UI workflows.

Evidence is in `clankerdev-beta-20260924/remote-backup/`: four final receipts,
`summary.json`, native fixture receipts, final database verification and logs.
The first desktop attempt exposed a test harness Fetch-response accessor error
after snapshot acceptance. The harness was corrected and resumed that saved
ID without creating a duplicate; the failure log is retained. Pinned KB
`bin/check` passed, including all 120 existing legacy PNGs. No new product code
was needed and the previously validated UI/API pins remain unchanged.

This gate does not certify scheduled backup execution, every restore topology,
or disaster recovery. API cursor agreement, remaining KB/admin coverage and
human release review remain open.

# Concurrent OAuth refresh can invalidate freshly returned tokens

Confirmed on the isolated UI `e50b8e70ec659659f6d2898d2fe1a72f9953ef5f` and
API `486350466e8fb6f966add1cde3fa2bc12b4d6b62`. No shared deployment was changed.

## Reproduction

Use only the dedicated fixture OAuth client `clankerdev-kb-test`, verify its
redirect/auth-start URLs, and record its original non-secret settings. Set
fixed 75-second access tokens, 180-second refresh tokens and refresh issuance.
Log in the fixture member, navigate to a same-origin static health page to stop
SPA polling, then wait 20 real seconds to enter the BFF's 60-second refresh
window. From one browser session issue eight parallel `/session.json?probe=N`
requests. Request `/users/current` with each returned token, then with the token
from a subsequent `/session.json`. Restore and verify the original client
settings in `finally`; log out all fixture sessions. Never serialize tokens.

The real VM returned eight non-empty tokens, but subsequent API validation
returned `[401,401,401,401,401,401,401,200]`. The later session request returned
a valid token (200). The affected tabs can therefore receive an immediately
invalid access token and follow the normal expired-session UI flow. This probe
confirms invalid token delivery; it does not claim that it directly observed
the final logout screen or a permanently lost server session.

The first probe used two identical URLs and both returned the same valid token.
A second probe used distinct URLs and returned differing tokens, but did not
validate them. Only the third probe validates token usability and confirms the
failure. All three original receipts are retained.

## Cause and required fix

`bff/server.js:ensureFreshToken` exchanges the refresh token independently for
each request and relies on the response's later Express session save. Parallel
requests can load the same stored token before any response saves the rotation.
The API's `authentication/oauth2_config.rb:refresh_tokens` rotates access and
refresh tokens. Concurrent success does not mean all returned tokens remain
valid. A deterministic local provider that rejects refresh-token reuse instead
produces two exchanges, one anonymous response and an anonymous later session.
That provider result is fixture evidence, distinct from the VM result above.

Serialize renewal per stored session, re-read current state before exchange,
and persist the winning state before allowing another request to reuse it.
Test overlapping session/passkey requests, a failed refresh and concurrent
logout, including stale request snapshots and slow/disconnected clients.
Logout must not be undone by a late refresh save. A promise map that is dropped
before Express saves the session is insufficient. Document any single-process
limit; do not imply cross-worker exclusion without a shared locking mechanism.

The ordinary fixture client uses `issue_refresh_token=false`; this defect is
confirmed in the supported refresh-enabled configuration. A tab retaining an
old access token after another tab rotates it is a separate open-SPA concern.
No backend change or upstream PR is required merely to serialize BFF requests.

## Evidence

`clankerdev-beta-20260924/session-gates/refresh-race-validity-desktop-cs.json`
records both immutable pins, status codes and verified client restoration.
The bundle also contains initial probes, sanitized logs and both reproduction
scripts. Tokens, passwords and MFA provisioning artifacts are not captured.

## Correction prepared in PR500

[PR500](https://github.com/Kerrycek/clankerdev/pull/500), head
`2fa71fe9bdd35781bb4c03acae2b445f28a1bad5`, queues requests by the verified
session cookie before Express reads the store. The queue is released from the
underlying response end, after Express completes its store save/touch. This
covers bootstrap, the PR499 passkey handoff, login/callback and logout together.
Socket closure does not release an unfinished operation; queued disconnected
requests are skipped. A bounded queue returns 503 above 32 requests per session.
Different users are independent.

The mechanism assumes one BFF process per file store; it does not provide
distributed locking or refresh a token already held in an open SPA after a later
rotation. These limits are documented in `bff/README.md`. No API change is made.

Standalone `ci:pr` passes (1,427 unit, 128 script tests, lint/audits/typecheck),
and the final BFF suite passes 31 tests. Three new regressions fail with the
queue disabled. Tests cover simultaneous refresh, provider failure, logout,
active/queued client disconnect, independent users, delayed store persistence
and queue capacity. Integrated candidate `4a3ea18b` passes 35 BFF tests locally
and during the actual Nix package installation check.

The corrected isolated VM passed four real Playwright variants, cs/en on
desktop and 390×844 mobile, at UI `4a3ea18b1870a86ab47c48e4a3ffa45c37248d0c`
and API `486350466`. Each variant sends eight simultaneous bootstraps plus a
passkey handoff. All nine return the same token and validate through actual API
requests with 200. Logout then revokes the latest token (API 401) and clears
the BFF session. Each run restores and verifies the dedicated OAuth client's
original settings. No token or provisioning artifact is serialized.

Evidence: `session-fix/refresh-{desktop,mobile}-{cs,en}.json`, matching logs,
Nix build/install-check log and pinned KB check log. All four receipts record
completion and restoration. Precise failed-refresh/disconnect/logout overlaps
are covered by deterministic BFF tests, not claimed as VM timing evidence.

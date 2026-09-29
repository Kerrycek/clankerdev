# Failure diagnosis and operational boundaries

Use this with [configuration](CONFIGURATION.md) and the host-specific runbook.
Inspect only the approved environment. Start with read-only evidence; a restart,
logout, store reset, user mutation or replay is a separate operational action.
No step here authorizes running a destructive scenario against a real user.

## First evidence to collect

Record frontend build SHA, BFF release/process identity, time/timezone, affected
route, role/view, browser and reproduction steps. For a request record method,
resource, HTTP status and a sanitized error, without bearer headers/cookies,
OAuth codes/correction tokens, raw response bodies or applicant data. A screenshot
of an authenticated production page is not safe by default.

On an already authorized service host, `systemctl status webui-next-bff.service`
and `journalctl -u webui-next-bff.service --since '10 minutes ago'` help locate
server failures. Inspect logs privately before sharing excerpts: provider/session
errors and reverse-proxy URLs can contain sensitive context. Do not print the
service environment or session store to a public issue. Inspect nginx access/error
logs according to the actual host config; no central alerting/SLO system is proven
by the existence of /healthz.

## Symptom to next boundary

| Symptom | Check first | Correct interpretation / next step |
| --- | --- | --- |
| Blank page or failed bootstrap | Asset status/MIME, CSP console errors, build base, config.js then session.json response type | SPA fallback HTML is not JSON. Compare actual webroot/build revision and proxy routes before changing auth. |
| /healthz works but login fails | External callback exact match, forwarded HTTPS/host, cookie flags, provider reachability, writable private store | Health only proves an HTTP handler responds. Secure cookies require correct HTTPS proxying; never remove Secure to mask a routing issue. |
| session.json returns 403 | Same-origin/Fetch Metadata/Origin checks and external origin derived from callback | Anonymous raw curl without browser-like origin headers can be denied intentionally. Use reviewed auth smoke; do not loosen origin checks. |
| API preflight/401/403 | Actual configured API version, HaveAPI header, CORS origin, role/owner and token recovery | CORS failure differs from permission denial. A valid login does not grant access to another owner. |
| Intermittent refresh/logout | One BFF process per store, overlapping requests and provider errors | Per-cookie queue is process-local. A stale tab token can use bounded recovery; do not run multiple workers against the same store or retry mutations blindly. |
| Header remains at a duration | preferred_session_length seconds and actual trusted input; compare elapsed idle time | Human activity can reset countdown. Polling/focus must not. Cookie max age and access-token lifetime are different clocks. |
| Theme/language not retained | Local vs server persistence, GET namespace/key and keyed PUT, sync error in UI | A local success is not server persistence. Avoid obsolete collection PUT or an unrelated user_sessions path; do not clear all browser state to hide the error. |
| VPS delete errors on dev | Prior action receipt/state plus API retention policy | Frontend modes cannot supply a missing default lifetime policy. Determine acceptance before a new attempt. |
| VPS/restore/migration says queued | Action state, transaction chain and resulting object | Acceptance is not completion; inspect failed chain and actual content/placement in an owned environment. |
| UI remains blocked after response loss | Stored target/intent, operation receipt and fresh server state | Absence from a short recent-history list is insufficient to prove non-execution. Explicit reconciliation precedes unlocking/retry. |
| DNS saved but answer unchanged | Transaction outcome, intended authoritative server and record TTL/cache | Query isolated authoritative service for real proof; fixture payload assertion does not prove publication. |
| Empty/duplicated/missing list rows | Scope/filter serialization, backend order/cursor, failed response vs genuine end | See known cursor blockers. Do not certify lossless paging using monotonically increasing mock IDs alone. |
| Map/heatmap/console unavailable | Configured HTTPS URL, eligibility, CSP/frame policy and external service | Preserve useful fallback and bounded retry; do not broaden all frame/connect origins. |
| Works locally, fails CI | Exact Node/npm/browser pins, dependency installs, fixture server identity, selected suite | Root npm ci misses BFF dependencies. A historical WebKit project is not in default config. Read failure artifacts; don't skip checks. |

## Security review map

These are documented defenses and residual boundaries for the receiving reviewer,
not an independent penetration-test result. Follow the linked implementation/tests.

| Boundary | Review focus and evidence entry |
| --- | --- |
| OAuth callback | State age/consumption, session regeneration, next-path sanitization, bounded provider responses: [security](../../bff/security.js), [tests](../../bff/security.test.js) |
| Session token exposure | JSON-only same-origin endpoint, no credentials in config.js, stale-token cleanup: [bootstrap tests](../../src/app/runtimeBootstrap.test.ts), [BFF server](../../bff/server.js) |
| Impersonation | Borrowed full token in sessionStorage, renewable interval versus absolute expiry, return/close failure and underlying operator auth: [exact flow and missing proof](ACTION_CONTRACTS.md#impersonation) |
| Privilege/ownership | Numeric role plus selected view and direct route/action gates; API authoritative: [role fixture](../../e2e/specs/app/vps_support_permissions.spec.ts) |
| Embedded HTML/external origins | Mail template preview sandbox and fetch defenses; map/heatmap/console URL checks; CSP kept narrow: [template fixture](../../e2e/specs/admin/mailer_template_crud_safety.spec.ts), [CSP audit](../../scripts/audit-csp.mjs) |
| Destructive ambiguity | Fresh target check, required receipt, persisted uncertainty and no automatic replay: [lock tests](../../src/components/layout/useLocalMutationLocks.storageIntegrity.test.tsx) |
| Third-party dependencies | Both lockfiles and production audit gates; review license/advisory changes instead of forced upgrades: [CI](../../.github/workflows/ci.yml) |
| Automated issue input | Trusted users/org membership or approval of exact issue snapshot; unknown membership fails closed: [runner policy](../../deploy/ai-issue-runner/README.md) |
| Operational secrets/artifacts | Restricted store/environment/backups/logs; independent owner/retention/access review in [handover](HANDOVER.md) |

For suspected secret exposure, stop sharing raw artifacts, preserve restricted
incident evidence and involve the credential/service owner for scoped revocation
and session invalidation. A frontend rollback does not revoke a leaked token.

## Escalation and closure

Classify the first failing boundary: frontend layout/model, BFF session, API
validation/permissions/order, queued backend operation, external service or target
configuration. Record a reproducible synthetic case and a relevant regression test.
Use the backend proposal process for API gaps rather than silently changing the
UI contract. An operator decides shared configuration changes and rollback.

Close with the tested revision, affected scope, real-vs-fixture evidence and
remaining limits in the feature/release work log. Preserve failed-run history.
A successful retry alone does not explain an intermittent failure. Owner contacts,
alert routing, retention and response targets must be supplied by the receiving
service team; this document does not invent an on-call arrangement.

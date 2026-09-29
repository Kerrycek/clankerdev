# Maintainer handover and acceptance

Reviewed 2026-09-29 against main `156a7c04`. Documentation can describe open
work completely without claiming that the product is fully certified. This
checklist is for the **receiving maintainer**, not an authorization to deploy.

## First-day walkthrough

1. Read [requirements](REQUIREMENTS.md), [action contracts](ACTION_CONTRACTS.md),
   [architecture](ARCHITECTURE.md) and [decisions](DECISIONS.md).
2. Follow one registration reconsideration, one DNS TTL update and one soft/hard
   delete from contract to source and test using [evidence](EVIDENCE_MATRIX.md).
3. Follow [DEVELOPMENT.md](DEVELOPMENT.md) and [CONFIGURATION.md](CONFIGURATION.md).
   In a clean checkout at the selected revision, install the supported Node/npm
   and locked dependencies; run `npm ci`, `npm run audit:design-docs`,
   `node --test scripts/design-docs.test.mjs`, then the relevant product suites.
   BFF tests require `npm ci --prefix bff`. Read scripts before host operations.
4. Inspect a fixture scenario locally without real credentials. Compare current
   layouts with [visual references](VISUAL_REFERENCES.md), distinguishing open PRs.
5. Walk through the [dev runbook](../../deploy/dev.crucio.cz/README.md) and
   [public promotion/rollback](../../deploy/clankerdev.vpsfree.cz/release.md).
   Identify source SHA, frontend build, BFF process and retained rollback artifact.
6. Verify access to restricted evidence and operational secrets through the
   designated private channel. Do not copy them into issues or documentation.
7. Record acceptance, exclusions and remaining owners below in a review follow-up.
   A test failure is investigated; a missing receipt remains missing evidence.

## Acceptance and ownership

No person is silently appointed by this document. The product maintainer selects
the receiving people and records their acceptance in the handover PR.
“Unassigned” is a concrete remaining decision, not a claim of completion.

| Handover item | Required reviewer / owner | Completion criterion | State |
| --- | --- | --- | --- |
| Product intent and accepted pending changes | Product maintainer | Confirm register/action catalog; resolve disputed behavior explicitly | Awaiting review |
| Legacy completeness | Service/legacy maintainer, unassigned | Review action/field gaps by domain and approve exclusions; known restored features are not exhaustive parity | Open |
| Frontend/BFF code transfer | Receiving maintainer, unassigned | Clean-checkout setup and critical source-to-test walkthrough succeeds | Procedure ready; walkthrough pending |
| Release operation | Receiving operator, unassigned | Rehearse dev/public promotion and rollback with a recorded receipt in an owned environment | Versioned instructions ready; new rehearsal pending |
| Private evidence archive | Current custodian and receiving operator | Transfer access, hashes, retention and sanitized scenario index; verify actual contents | Prior evidence remains custodian-held |
| API compatibility | Backend/service owner, unassigned | Agree selected API pin and ordering contracts; decide excluded cursor work | Blocked REQ-042–044 |
| Auth/VPS/DNS/storage real proof | Verification owner, unassigned | Reconcile prior pinned receipts; rerun only affected gaps with synthetic data and cleanup | Partial prior proof, exact candidate pending |
| Full application/account lifecycle | Verification owner, unassigned | Approve/deny/account state, permission errors, persisted outcome and cleanup on exact pins | Open REQ-039 |
| Dev delete retention | Service policy owner | Choose default policy or explicitly exclude unsupported dev path; authorized config verification | Open REQ-022 |
| Mobile toast and session audit consumers | UI/test maintainer | Scoped fixes/evidence for REQ-058/059; no bypass of origin checks | Open |
| KB minimum | KB editor/maintainer, unassigned | Agree article/page-binding list, review wording and real cs/en captures; preserve old evidence | Open REQ-057 |
| Independent security review | Independent reviewer, unassigned | Scope, findings, severity, remediation decisions and residual risk recorded | Not completed by self-review |
| Final beta acceptance | Product/service maintainers | Exact UI/API candidate, exclusions, known limits, rollback and explicit publication authorization | Open |

Public documentation should identify the existence and scope of restricted
artifacts without exposing their contents. A private transfer receipt can be
referenced by a non-secret inventory ID; it must not be an inaccessible personal
path presented as a public proof link.

## Newadmin cutover

**Chosen hostname: newadmin.vpsfree.cz.** The maintainer selected it on 2026-09-29;
earlier newui/nextui/webui suggestions are superseded. Dedicated deployment SSH
public-key preparation is recorded; target installation/access has not been
verified. Private keys must remain on their original machines. No DNS, target
service configuration or cutover was performed by this documentation work.

Before a separately authorized cutover:

- Resolve target host, SSH account/port, verified host fingerprint and least-needed
  deployment privileges with the receiving operator. Verify the dedicated deploy
  identity independently of personal operator access; define revocation ownership.
- Confirm A/AAAA records, reachability and certificate issuance/renewal. Do not
  copy a private TLS key into source or infer working IPv6 from an AAAA record.
- Register the exact OAuth redirect URI, origin/cookie configuration and API
  CORS/auth-header rules; review CSP/connect/frame targets and public runtime
  config. Secrets stay in the target's protected environment, never config.js.
- Decide old-host redirect/parallel-access policy. Cookie-bound sessions do not
  automatically transfer to a different origin; verify fresh login, MFA/passkey
  handoff, logout, expiry, preferences and safe return URLs on the actual target.
- Decide the release SHA, API pin, artifact hashes, rollback target and cutback
  ownership. A hostname choice does not approve an arbitrary branch or API change.
- Check public status, deep links, assets, anonymous session JSON, BFF process
  provenance, console/heatmap external policies and supported cs/en mobile/desktop
  flows. Use synthetic objects for authenticated verification.
- Record rollback/cutback steps and success criteria before changing traffic.
  Keep existing hosts and retained artifacts until the service owner approves
  retirement. KB publication/URL updates have a separate review.

## Maintenance after acceptance

Behavior changes update their requirement/action contract, verification references
and per-feature log in the same PR. Include the expected negative case, role and
state, not only a happy screenshot. Reviewers check that source-derived preservation
rules are not falsely attributed to a past user request.

After merge/release, append the sanitized outcome with revision and scope in a
follow-up; do not leave only a local receipt. Tests named “live contract” may still
be fixtures. Never upgrade their evidence category by renaming documentation.


## Additional credential verification gap

The reverse coverage review identified an undocumented impersonation boundary;
its exact behavior is now in [account contracts](ACTION_CONTRACTS.md#impersonation).
Existing model coverage is not a complete live start/return/revocation check.
Include target identity, denied callers, reload, renewable expiration, close failure
and expired operator auth in the receiving security/live verification scope.
Returning to the operator UI tolerates token-close errors and must not be recorded
as confirmed revocation. This gap was found by source review, not a live incident.

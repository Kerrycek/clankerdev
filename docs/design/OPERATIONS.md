# Operations and handover

This is the operational map for a new maintainer, not authorization to change a
server. Requirements REQ-056–066 apply. Use the versioned host runbooks and inspect
actual service configuration before executing deployment commands.

## Repositories and environments

| Component | Role | Boundary |
| --- | --- | --- |
| Kerrycek/clankerdev | React frontend, OAuth BFF, fixture tests, deployment scripts and this handbook. | Product changes through reviewed PRs. |
| vpsfreecz/vpsadmin | HaveAPI, legacy UI and infrastructure reference. | Read-only unless a specific backend task is explicitly authorized. |
| vpsfreecz/vpsfree-kb-contracts | Navigation/page/capture contracts and isolated scenario runners. | Independent UI/API pins; KB publication separately approved. |
| dev.crucio.cz | Shared test frontend using the test API. | Not a disposable sandbox; retain other users' objects/configuration. |
| clankerdev.vpsfree.cz | Shared frontend against the service API. | Real users/data; only scoped authorized release operations. |
| Owned isolated cluster | Synthetic live API/VM workflow certification. | Verify ownership/provenance; do not replace another initiative's VMs. |

## Local development

Use a clean isolated worktree; preserve unrelated main-checkout changes. Install
supported Node/npm dependencies, run `npm ci`, `npm run dev`, and follow the
[verification commands](VERIFICATION.md). Use the local runtime config example in
[public](../../public/config.local.js.example). Keep private config out of commits.
Fixtures allow layout/browser work without real credentials. The OAuth BFF has its
own [environment/setup requirements](../../bff/README.md).

## Release procedure

1. Resolve approved PR scope, exact heads, reviews/CI and backend compatibility.
   Do not silently include open dependency PRs or superseded/rejected proposals.
2. Build an integrated candidate from approved heads. Run relevant/full release
   checks, record tree/revision and known limitations. Do not force green CI.
3. Obtain/confirm authorization for the concrete candidate and target hosts.
4. Preflight current frontend and BFF provenance, clean source/release, free space,
   service health and pending work. Inspect repository hooks so deployment is not
   unintentionally executed twice. Do not interrupt a healthy existing operation.
5. Retain previous immutable frontend/BFF artifacts and private config snapshots.
   Record restore paths securely, not in public docs. Preserve secrets and API/db
   state; no migration is implied by a frontend release.
6. Follow the [dev runbook](../../deploy/dev.crucio.cz/README.md) and
   [immutable deployment script](../../deploy/dev.crucio.cz/deploy-dev-crucio-clankerdev.sh).
   The historical [public bootstrap guide](../../deploy/README.md) describes host
   provisioning; do not rerun provisioning blindly for a routine update.
7. Promote the exact verified frontend artifact and matching BFF revision to the
   other approved target. The last release used dev-built dist on both sites.
   The one-off public promotion/rollback wrapper remains operator-held, not a
   complete checked-in repeatable release tool: transfer/review it before handover.
8. Verify `/build-info.json` and BFF process path separately, public health,
   anonymous `/session.json` and OAuth routing. Use
   [auth smoke](../../deploy/smoke-auth-endpoints.sh). Check SPA deep links and assets.
9. Run appropriate post-deploy browser checks, clearly labeling fixture versus
   actual API checks. Record result, exact revision, previous rollback revision
   and limitations in WORK_LOG.md; update requirement status.

## Rollback

Rollback trigger examples: broken authentication/session routing, wrong frontend
or BFF provenance, missing static assets, or a confirmed critical regression in the
approved scope. Preserve failure evidence and avoid replaying ambiguous mutations.

Restore the retained matching previous frontend/BFF release and webroot using the
host's validated backup mechanism, restart the BFF, validate nginx if configuration
was changed, then recheck provenance, health, auth and deep routes. Restore configs
only when needed; do not overwrite unrelated changes or secrets. Frontend rollback
does not undo API mutations or database migrations. A migration needs its own plan.

The prior recorded release is `2eef5193403258c88ec4fca79138898aaf4273cc`; last
recorded deployed release is `fd290b5ec1b22900e704e8cb990c5ba050af2394`. These are
historical receipts, not permanent “current” pointers. Check actual state before use.

## Ownership and secure handover checklist

The following cannot be solved by publishing credentials in a repository:

- Name product acceptance, frontend/BFF operations, backend/API and KB owners.
- Transfer host access, OAuth client ownership, session secrets, certificates/DNS
  ownership and monitoring access through an approved private channel.
- Transfer retained release/rollback artifacts and scripts with hashes and an
  operator walkthrough; rehearse restoration in an owned environment.
- Transfer private evidence/receipt locations and review sanitized summaries for
  durable CI/repo storage. Never publish production screenshots or personal data.
- Confirm API version/capabilities and unresolved cursor/deletion policies.
- Agree KB publication path and beta hostname; do not infer these from suggestions.
- Arrange independent audit scope and track findings, severity, ownership and closure.
- Keep the scheduled autonomous-development automation paused until explicitly
  resumed. A direct UI/docs task does not resume it.

See the [beta gates](VERIFICATION.md) for outstanding certification. This handbook
provides a source-contained design handover; it does not claim private operational
access transfer, a full audit, or public-beta approval has happened.

## Issue-to-PR automation trust policy

REQ-067 is separate from the paused development heartbeat. The dev host's issue
runner polls the `ai-fix` queue. Its explicit author/membership/approval policy,
read-only eligibility check and rollback procedure are documented in the
[runner runbook](../../deploy/ai-issue-runner/README.md). Approval is bound to the
current external issue content; filtered external feedback cannot independently
trigger another model invocation. The runner proposes PRs and does not merge or
deploy them. Read-only polling/authentication health does not prove a fresh
end-to-end Codex invocation; do not spend tokens just to claim that proof.

# Documentation handover completion

## 2026-09-29 — Address the critical documentation review

**Request:** prepare the documentation properly before PR approval. The receiving
colleague asked for English repository documentation covering requirements,
what/why/how and history, kept current, with a scalable work log and usable handover.
The previous review found generic workflow coverage, weak evidence traceability,
stale statuses and reliance on a private public-deployment wrapper.

**Scope:** REQ-064, plus documentation of existing requirements, accepted pending
REQ-028/038 and chosen hostname REQ-066. Runtime baseline is main `156a7c04`.
The clean existing documentation worktree was reused, preserving main-checkout
changes and retaining the earlier PR527 completion receipt (`028d0f7f`).

**Changes:** add concrete action/state/role/input contracts, a verification entry
for all 67 requirement IDs, critical acceptance examples, pending PR528/529 pins,
maintainer acceptance/ownership checklist and newadmin cutover gates. Correct
stale delivery/decision text. Version the public promotion and rollback procedure
from the retained release record. Copy three inspected synthetic visual references
with provenance. Extend docs checks to evidence coverage, local heading anchors
and deployment guides, with negative tests. Document semantic review obligations
and release receipt publication without restoring a shared append-only work log.

**Verification (2026-09-29):**

- `node scripts/audit-design-docs.mjs`: passed, 46 documents, 67 unique
  requirements, unchanged 256-route/63-adapter inventory. Includes local heading
  anchors, evidence row coverage and deployment-guide links.
- `node scripts/audit-active-docs.mjs`: passed, 1,337 files scanned before staging.
- `node --test scripts/*.test.mjs`: 153 passed, including 11 documentation cases
  and negative cases for missing/duplicate evidence rows, stale anchors and
  broken deployment links. The shell wrapper subsequently hit zsh's read-only
  `status` variable when capturing the exit code; the completed TAP summary had
  153 pass, zero fail/skip. No product failure was hidden.
- `node node_modules/vitest/vitest.mjs run` for RequestReviewActions,
  VpsDeleteModel, VpsAdminLifecycleModel, DnsRecordModel and dnsTtlContract:
  five suites / 40 tests passed. These are unit tests, not real API operations.
- All three public-runbook Bash blocks passed `bash -n`; none was executed.
- `git diff --check`: passed. Three copied synthetic PNGs inspected and hashed.

The first evidence audit exposed duplicate matches from the separate critical-case
table. The coverage validator now explicitly scopes the requirement-coverage
section; negative tests still reject actual duplicate/missing rows.
No runtime code or API contract was changed. No shared service operation,
user-data mutation, real mail delivery, migration or new live certification was
performed. Runbook validation is syntax/source review, not an executed deployment.

**Status:** prepared for review; not merged or deployed. General autonomous work
remains paused. No product PR was merged by this documentation change.

**Remaining:** receiving-maintainer acceptance and runbook rehearsal; custodial
transfer/reconciliation of restricted live receipts; legacy parity review; pending
product PRs and backend cursor decision; beta/security/KB gates. These are explicit
in HANDOVER.md and the audit disposition, not falsely closed by documentation CI.


## 2026-09-29 — Second completeness review and clean setup rehearsal

**Request:** critically check completeness again and fill remaining documentation
holes before acceptance. Continued [PR530](https://github.com/Kerrycek/clankerdev/pull/530).

**Findings/fixes:** first-run instructions omitted the separate BFF installation;
.env.example still offered an obsolete settings resource/namespace; local BFF
setup did not explain Secure-cookie/same-origin HTTPS requirements. Added the
clean-checkout walkthrough, configuration/defaults/precedence reference (all 27
BFF environment inputs checked against source), persistent-data boundaries,
symptom-driven diagnosis, security review map and domain glossary. Corrected
examples and BFF guide, included that guide in link/anchor auditing. Added two
new reviewed-main synthetic visual references alongside pending-feature images.

**Fresh verification:** exported staged source tree `8818bc6d2a49019ae13673419aba26ec8466e6a4` into
an independent temporary directory, initialized its Git index for inventory checks
and installed dependencies from both lockfiles without reusing node_modules.
Node 24.19.0 / npm 9.9.4. No API credentials, shared configuration or service
mutations. Product runtime and fixture source unchanged from main156a7c04.

- Both npm ci commands passed; install audits reported zero vulnerabilities.
- npm run ci:pr passed: typecheck, lint/i18n/CSP/design checks, 153 script,
  36 BFF and 1,514 unit tests (270 unit suites).
- npm run build passed; existing >500 kB locale chunk warning remains. Build
  from this index-only export is setup validation, not a release artifact or
  source-provenance certification; it was not deployed.
- Two targeted Chromium fixtures passed: Czech registration layout/risk position
  and admin VPS header. Captures inspected for synthetic data and copied unchanged
  with hashes/source provenance. This is not live API or map service proof.
- Final design audit: 50 documents, 67 IDs, unchanged 256 routes/63 adapters;
  active-doc audit: 1,340 files. Eleven focused docs tests passed.

The original PR530 head5e2ab2d3 static CI passed while its browser job was still
running during this follow-up. New remote checks apply to the updated head;
prior results must not be relabeled as that final head's CI.

**Status:** documentation/examples/checks only; no merge/deploy. Remaining receiver
acceptance, private-evidence transfer, operator rehearsal, legacy parity review,
independent security and known product/KB gates remain explicit. Full test output
is retained privately by the current operator; public results and reproducible
commands are here and in the handbook. No general automation was resumed.


## 2026-09-29 — Reverse coverage and semantic corrections

**Request:** recheck completeness critically before PR approval.
**Findings/fixes:** reconciled stale source provenance; mapped all 63 API modules
once to behavioral docs, including helpers/types and non-adapter boundaries;
added account lifecycle, environment limit units/inheritance, credential/mail
rules and impersonation behavior/storage/return limits. Corrected the misleading
mail-template CRUD claim: whole-template and standalone-recipient deletion is
intentionally blocked, unlike translation/relationship deletion. Full
impersonation lifecycle proof is explicitly missing, not inferred from model tests.

**Verification:** 12 documentation cases and all 154 script tests passed, including
missing/duplicate/nonexistent domain-map negatives. Initial broad script command
lacked Node on PATH; two runner-shell cases failed prerequisite detection. Correct
runtime PATH resolved them, without test changes or skipped gates. Design audit:
51 documents, 67 IDs, 256 route declarations, 63 modules. Active-doc audit and
whitespace passed. Prior d660b019 static CI passed; its browser run was still
active while reviewing. New checks must validate the new commit separately.

**Status:** updated the existing PR530; source/examples/docs audit only, no runtime
behavior changes, shared mutations, merge or deploy. Prior clean-export full-suite
and build evidence is retained with its original scope, not relabeled as a new run.
**Next:** receiving review and explicit assurance gaps in HANDOVER.md. A complete
module index is not exhaustive legacy parity or an independent security audit.


## 2026-09-29 — Operator walkthrough corrections

**Request:** another completeness check, focusing on a receiving maintainer's
ability to use the instructions rather than merely follow links.
**Changes:** clarified that deploy-dev pulls main, documented the pinned input
checkout/direct-helper procedure and mutable-checkout coordination; locked manual
dev rollback and validated snapshot metadata before restoring/removing anything;
added public unit/environment change detection at preparation/activation/rollback.
Corrected shell-versus-path example labels and fixture-wrapper wording.

**Verification:** all 15 executable Bash/sh blocks in the dev/public runbooks
passed bash -n (not executed). The first syntax sweep exposed a bare path with
an angle-bracket placeholder incorrectly tagged as shell; path blocks now use
text. Design audit, 12 focused documentation tests and whitespace passed.
Prior deb30765 static CI succeeded; its browser run was ongoing during review.
No runtime source changes, host mutations, merge/deploy or resumed automation.
**Status:** same PR530, awaiting receiving review. The source-checked runbooks still
require the recorded owned-environment operator rehearsal, not a claim of live proof.


## 2026-09-29 — Explicit capability boundaries

**Request:** critically recheck completeness before approval.
**Finding/change:** generic API guidance did not identify intentional search/filter
limits or node create/edit differences. Added a source-linked table for six list
areas, distinguished transaction-item and chain filters, recorded namespace scope
normalization and node metadata-gated limit clearing. No runtime behavior changed.
**Verification:** design/active-doc audits and whitespace checks passed. Both remote
checks of preceding head adcd8256 passed (runs 36563544786 and 36563544589); the new
prose commit must receive its own checks. Linked regression cases were inspected,
not represented as new live tests. Existing full-suite evidence keeps its original
scope.
**Status:** same PR530, prepared for review, no merge/deployment. Remaining receiving
acceptance, operator rehearsal, independent security review and missing live/legacy
proof are still explicit in HANDOVER.md; they are not closed by documentation edits.


## 2026-09-29 — Prevent stale public rollback instructions

**Request:** another completeness check from the receiving operator's perspective.
**Finding/change:** public rollback lacked a guard against restoring an old backup
after another release became active. Preparation now retains the candidate path;
rollback accepts only that candidate or its previous release before any mutation.
The instructions also require ruling out intervening same-revision promotions.
**Verification:** executable runbook blocks passed bash -n. The exact pointer guard
passed an isolated local harness for candidate/previous pointers and rejected an
unrelated newer pointer and a missing pointer. The initial harness used macOS
/var paths while readlink returned /private/var; using canonical fixture paths
resolved that harness mismatch. The recorded candidate also uses a canonical path.
Both documentation audits and
whitespace checks passed. No shared host commands executed.
**Status:** same PR530; receiving review and operator rehearsal still pending.
Preceding baf47380 static CI passed; browser smoke was running during the review.
The new documentation commit needs its own CI; no merge/deploy performed.

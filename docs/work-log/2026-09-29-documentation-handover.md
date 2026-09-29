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

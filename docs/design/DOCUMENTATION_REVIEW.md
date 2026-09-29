# Documentation review and audit disposition

Review date: 2026-09-29. Runtime baseline: `156a7c04`.
Scope: recovered maintainer intent, handbook/source consistency, concrete client
contracts, test traceability, operations and receiving-maintainer usability.
This is a self-review of documentation, not an independent code/security audit.
No deployment or API mutation was performed for this review.

## Findings and treatment

| Finding | Correction in this change | Remaining acceptance boundary |
| --- | --- | --- |
| D01 High: domain-level requirements were too broad to protect behavior | [Action contracts](ACTION_CONTRACTS.md) add request role/state/bulk matrix, applicant fields, VPS deletion modes, migration flags/timing, DNS validation/payload rules and storage workflows. Other domains have explicit action/test inventory. | Exhaustive legacy field/action parity still requires service-maintainer review; broad rows are not represented as certified. |
| D02 High: requirements lacked concrete test/evidence mapping | [Evidence matrix](EVIDENCE_MATRIX.md) covers all 67 stable IDs, critical named cases, pending branch pins and missing live proof. Source, fixture, policy review and live receipts are distinguished. | This is representative traceability, not all acceptance cases proven; private receipt reconciliation and exact-candidate live gaps remain. |
| D03 High: public release procedure depended on a private wrapper | [Versioned public runbook](../../deploy/clankerdev.vpsfree.cz/release.md) describes trusted artifact inputs, lock, preflight, source/BFF identity, promotion, verification and partial-failure rollback. Dev runbook remains linked. | Rewritten procedure syntax/source reviewed; receiving operator rehearsal is pending, no shared host changed. |
| D04 Medium: current docs called delivered changes pending | Corrected favicon, icon-only heatmaps, handbook and navigation decisions using merged PRs; baseline and dated release receipt are explicit. | A dated receipt is not a fresh runtime probe. |
| D05 Medium: accepted pending intent and selected hostname were missing | Records PR528 dropdown and PR529 localized reasons with exact heads; newadmin.vpsfree.cz decision and [cutover gates](HANDOVER.md#newadmin-cutover) added. | Both product PRs remain pending; target access/DNS/TLS/OAuth/cutover not verified. |
| D06 Medium: PR527 outcome existed only locally | Incorporates the existing completion receipt in the [per-change log](../work-log/2026-09-27-per-change-work-log.md); describes publishing follow-ups before handover. | Restricted deployment artifacts still need custodian-to-recipient transfer. |
| D07 Medium: docs CI could pass absent semantic coverage | Adds evidence-row coverage, local heading anchors and deploy-runbook links to audit, with negative tests. Adds the reviewer procedure below. | Automated link/ID checks cannot validate prose, intent, permissions or test adequacy. |
| D08 Improvement: visual reference depended on private attachments | [Versioned synthetic images](VISUAL_REFERENCES.md) retain capture date, exact branch pins, locale/theme, pixel dimensions, checksums and pending status. | Pending-feature and reviewed-main references; not an exhaustive current UI gallery or live KB capture. |

## Requirements from the receiving colleague

| Requested outcome | Where to review | Assessment |
| --- | --- | --- |
| English documentation in repository | [Handbook index](README.md) and linked docs/deploy files | Present and self-contained for the documented scope |
| Complete requirements list | [Register](REQUIREMENTS.md), action contracts and source register | Recovered requests plus code-derived preservation rules; missing original history and exhaustive legacy parity are explicitly unresolved |
| What exists, why, how it evolved | [Product design](PRODUCT_DESIGN.md), [architecture](ARCHITECTURE.md), [decisions](DECISIONS.md), [sources](SOURCES.md) | Rationale supported by recorded decisions; unknown rationale is not fabricated |
| Keep requirements current | Stable IDs, same-change update rules, inventory/evidence audit | Process and checks present; reviewer still judges semantics |
| Work log that scales to multiple contributors | [Per-change directory](../work-log/README.md) | Independent files; no shared entry list required |
| Complete handover rather than code alone | [Handover](HANDOVER.md), source/test walkthrough, versioned runbooks | Materials prepared; receiving owners, rehearsal and evidence access remain acceptance work |

The appropriate approval is **documentation ready for receiving review**, not
“100% beta” or “all historic requirements proven.” Product blockers must not be
hidden by marking this document complete.

## Semantic review required for every behavior change

1. Identify the concrete user request or explicitly source-derived preservation
   rule. Preserve the replaced choice and why it changed; do not invent a date or
   reason for an undocumented historic design.
2. Trace each affected action through role/view/owner gates, object states,
   preflight, API method/fields/units and final feedback. Compare the old UI/API
   only where relevant, and record any intentional difference.
3. Check empty/null/omitted inputs, stale identity, late data, busy operation,
   permission denial, partial bulk failure and transport ambiguity. Use concrete
   examples instead of “works correctly.”
4. Link a meaningful test or a manual evidence procedure to each affected
   requirement. Read its assertions: a test filename or passing unrelated CI is
   insufficient. Include missing proof and the reason it is missing.
5. Review cs/en, responsive layout, keyboard/focus, secret handling and synthetic
   visual provenance. Do not publish production screenshots to fill evidence gaps.
6. Check source revision versus tested/merged/deployed revision, dependencies and
   exclusions. Capture later release outcomes in the appropriate change record.
7. Run the automated audit and relevant changed-script tests. Review the rendered
   tables/images. Assign unresolved acceptance items rather than silently claiming
   closure; approval to document is not approval to deploy.

No mandatory edit to a global requirements file is needed for every unrelated PR:
update the relevant contract/evidence only when affected, plus its own work-log
file. New requirement IDs still need coordination. Do not merge unrelated feature
histories merely to avoid that coordination.

## Second completeness pass — 2026-09-29

A second review approached the repository as a new maintainer, not only as a
link checker. It found and corrected these additional gaps in the same PR:

| Finding | Correction / evidence |
| --- | --- |
| Clean setup omitted the separate BFF install | DEVELOPMENT.md and repeatable checks include npm ci --prefix bff; verified in a fresh staged-source export with no reused node_modules. |
| Settings example still recommended an obsolete resource/namespace | .env.example now uses /webui_user_settings and ui; checked against the actual keyed adapter. |
| Local auth instructions could suggest plain HTTP/two ports worked | BFF README and development guide now require same-origin HTTPS, exact callback, private writable store and one proxy hop; no Secure-cookie bypass. |
| Runtime precedence and persistence were undocumented | CONFIGURATION.md distinguishes runtime/VITE/defaults, standalone/BFF modes, all 27 BFF environment variables, cookie/token/idle clocks and storage/rollback boundaries. |
| Operators lacked symptom-driven diagnosis and security review entry points | TROUBLESHOOTING.md maps failures to their first boundary, safe evidence and escalation; it does not invent monitoring/SLOs or authorize destructive recovery. |
| Gallery showed only pending features | Added two inspected synthetic current-runtime references for registration/sidebar and VPS header, with exact source provenance and reproduction command. |
| BFF guide links were outside the docs audit | Included bff/README.md in link/anchor checks and fixture setup for audit tests. |

The clean walkthrough passed the full ci:pr command (1,514 unit, 153 script and
36 BFF tests), plus two targeted Chromium fixtures. The work log records build
and final checks. This validates the documented local setup at the reviewed
snapshot; it does not execute live OAuth integration or a host promotion.

Remaining gaps are **acceptance/evidence**, not silently omitted documents:
legacy maintainer validation of exhaustive parity, transfer of restricted receipts,
receiving-operator rehearsal, independent security review, exact-candidate live
checks, and the recorded product/KB blockers. Full historical conversations and
the original missing external specification cannot be reconstructed as fact.
Receiver approval is still needed; there is no defensible unconditional “100%
complete” claim before those decisions and proofs.


## Reverse coverage pass — 2026-09-29

This pass started from the route/API inventory and account/security/content source,
rather than treating a complete requirements table as semantic completeness.

| Finding | Correction / remaining limit |
| --- | --- |
| Source register still named the initial fd290b5e baseline and left hostname choice informal | Reconciled historical versus current source, PR525–530 and later explicit maintainer decisions. No new deployment is inferred. |
| Inventory did not connect every module to behavioral documentation | Added [domain coverage](DOMAIN_COVERAGE.md): all 63 modules assigned once, including types/helpers; route and non-adapter boundaries stated. Audit rejects missing, duplicate or nonexistent module assignments. This is not exhaustive action/test coverage. |
| Account details omitted credential switching and storage precedence | Documented impersonation request fields, renewable interval, full token in sessionStorage, auth precedence, banner and best-effort close/return. Full isolated lifecycle proof is now an explicit gap in evidence/handover. |
| Account/environment/mail rules were too generic | Added exact lifecycle/date/reminder fields, inherited versus custom environment limits and units, billing separation, credential resource differences and effective mail recipient order. |
| Mail action catalog incorrectly implied whole-template CRUD | Corrected intentionally disabled template/standalone-recipient deletion, its recorded rationale and distinction from translation/relationship deletion. |

Validation: 12 focused documentation tests, all 154 script tests, design audit
(51 documents / 67 IDs / 256 route declarations / 63 modules), active-doc audit
and whitespace check. An initial broad-script invocation omitted Node from PATH;
two shell-runner cases failed prerequisite detection. Rerunning with the documented
runtime on PATH passed all 154; no tests or gates were removed. Runtime source
remains unchanged, so the previous clean-install/full-suite/build/fixture evidence
retains its stated snapshot scope. New remote CI is required for the final PR head.

No known documentation omission from this bounded pass is hidden as complete.
The map is an index to reviewed contracts, not proof of every backend field or
inaccessible historical requirement. Impersonation lifecycle proof joins the
existing explicit live/security/legacy/receiver acceptance gaps; documentation
approval cannot close those product assurance items.


## Operator walkthrough review — 2026-09-29

Compared the contributor/handover commands with their actual wrappers and deployment
helper before treating the runbooks as usable handover material.

- The dev convenience wrapper pulls main; it does not deploy a supplied SHA.
  Documented that limitation and the coordinated pinned-checkout/direct-helper
  path, preserving the helper's canonical source restriction. A deploy lock does
  not prevent unrelated Git changes in the mutable input checkout.
- Manual dev rollback now acquires the same deployment lock and holds it through
  validation. It verifies required snapshot flags/files before a missing flag
  could be interpreted as permission to remove an old unit/configuration.
- Public promotion/rollback now compares observed unit content and private OAuth
  environment hash as well as nginx configuration. Rechecks run immediately before
  activation; config changes require a separate recovery decision. Participating
  deploy-shell locking does not prevent unrelated operator edits, so coordination
  remains explicit.
- Marked standalone path examples as text, not executable shell snippets. Clarified
  that the Playwright wrapper does not mock arbitrary selected tests; the fixture
  scenario installs its own synthetic responses.

All 15 executable shell blocks in the two reviewed runbooks passed bash -n after
correction; this is syntax/source validation, not a real promotion or rollback.
Documentation audit, focused documentation tests and whitespace checks were run.
The previous deb30765 static CI passed; its browser check was still running when
these documentation-only corrections were prepared. The final head needs its own CI.
No new claim of receiver acceptance, legacy parity or live verification is made.


## Capability-boundary review — 2026-09-29

Cross-checked list adapters, URL normalization and node edit serialization against
the handbook. The generic filter guidance omitted concrete intentional limits.
Added [capability boundaries](API_CONTRACTS.md#intentional-capability-and-filter-limits)
for exports, networks, migration plans, transaction items versus chains, namespaces
and resource packages. Documented node create/edit differences and metadata-gated
null clearing. Each boundary links to implementation and existing regression cases;
this pass changes documentation only and does not claim new backend validation.

Both remote checks for preceding documentation head adcd8256 passed:
[static/unit CI](https://github.com/Kerrycek/clankerdev/actions/runs/36563544786)
and [browser smoke](https://github.com/Kerrycek/clankerdev/actions/runs/36563544589).
The prose follow-up requires its own final-head CI. Local design/active-doc audits
and whitespace checks passed. The explicit handover acceptance and product-evidence
gaps remain; this review did not find another undocumented boundary in the inspected
adapters, but it is not an exhaustive field-by-field legacy parity certification.


## Stale rollback review — 2026-09-29

A further operator review found that the public manual rollback acquired the lock
and checked configuration drift but did not reject an unrelated active release.
The promotion now records its candidate path in the private backup. Rollback checks
that the active pointer belongs to that candidate or the previous release before
restoring anything; another active release stops recovery. Both pointers are valid
partial-failure states because frontend and BFF publication are separate. Operators
must still rule out intervening promotions of the same revision from the operation
record; a pathname alone cannot identify a deployment attempt.

All executable runbook blocks passed Bash syntax validation. An isolated local
harness exercised the exact release-pointer guard for candidate, previous,
unrelated newer and missing pointers: only the two expected states passed.
Documentation audits and whitespace checks passed. This validates the guard, not
a host rollback or the outstanding receiving-operator rehearsal.

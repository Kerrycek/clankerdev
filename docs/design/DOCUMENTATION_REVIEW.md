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

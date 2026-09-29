# Decision record and evolution

Dates refer to the recovered 2026-09-23–27 work period unless a linked PR provides
an exact timestamp. “Rationale” below is maintainer feedback or a labeled inference;
this is not a reconstruction of unavailable conversation text.

| ID | Decision / state | Why and alternatives | Consequence / evidence |
| --- | --- | --- | --- |
| DEC-001 | Keep two product views: user and admin. Current. | Maintainer explicitly rejected a new support-specific experience. Support still exists as a backend capability level. | Separate visual scope from authorization; do not remove support permission checks. [roles](../../src/lib/roles.ts) |
| DEC-002 | Retain useful legacy operational information and controls. Current. | Maintainer reported missing distribution/runtime metrics, overrides and deletion options. Simplifying presentation must not drop capability. | Header metrics, resource workspace and explicit privileged controls; PR503/505/513/518. |
| DEC-003 | Registration risk beside decision was replaced. Superseded. | PR494 emphasized risk near review. Maintainer found the right-side checks wrong and the page too stretched. | PR508 moved checks below details; PR511 compacted them; PR512 widened/grouped applicant area; PR516 placed metadata inside and compacted decision controls. Do not restore PR494 layout. |
| DEC-004 | Keep a small next-request preference, not a large decision card. Current. | Maintainer suggested removing or shrinking it because it consumed too much space; the implemented choice preserves queue usefulness compactly. | Buttons follow on the next row; PR516. Removal was an alternative, not the final behavior. |
| DEC-005 | Do not require opt-in before the existing applicant map. Rejected alternative. | Maintainer explicitly said not to restore PR435. This does not establish a universal external-service privacy policy. | Preserve useful address fallback; seek a new explicit decision before changing this behavior. [PR435](https://github.com/Kerrycek/clankerdev/pull/435) |
| DEC-006 | One workspace for compute and root disk, separate API saves. Current. | Administrators commonly resize both; separate pages were inconvenient. Backend operations are still separate. | Avoid an artificial atomicity promise; show target, overrides, validation and result for each operation; PR505. |
| DEC-007 | Header facts and equal overview columns. Current. | Maintainer wanted legacy distribution/uptime/load visible and object cards aligned. | PR513 followed header redesign feedback; PR515 equalized columns. Do not infer pixel-level requirements from old screenshots. |
| DEC-008 | Console starts on entry. Current. | Maintainer explicitly rejected the extra New session click. | Bounded token acquisition/reuse, preserve revoke/replace safety; PR517. |
| DEC-009 | Settings persist through keyed resource endpoint. Current. | Dark theme appeared lost after logout because the previous write contract was wrong. | PR519 corrects the API path; test guards changed only for exact legitimate method/path. Not a broad mutation allowlist. |
| DEC-010 | A fixed “40 min” is not a session timer. Current. | Maintainer observed an unchanged display after an hour. | PR514 tracks actual inactivity, preserving expiry and tab/reload semantics; background polling is not user activity. |
| DEC-011 | Icon-only heatmap action; preserve normal sidebar width/full labels. Current intent. | PR521 removes repeated per-node text. The maintainer clarified that their normal menu already has labels and should not be narrowed. | PR521 is delivered. PR522 now only distinguishes destination icons; its proposed 176px compact mode and short labels are withdrawn. Existing optional collapse behavior remains. |
| DEC-012 | Backend cursor proposal is not authorized for release now. Current constraint. | It was initially approved for preparation, then backend44 was explicitly rejected. Frontend dependent PRs remain open. | Keep #496/#507/#509 out of release until a new contract/decision; PR43 payment fix does not resolve them. |
| DEC-013 | Evidence comes from isolated owned systems and synthetic identities. Current. | Maintainer prohibited production personal data and interference with shared VMs/services. | Preserve UI/API pins, real-vs-fixture distinction, mutation receipts and cleanup; no replay just to inflate evidence. |
| DEC-014 | Autonomous work was stopped; later direct tasks are bounded. Current constraint. | Latest explicit stop overrides earlier recurring-work approval. | Do not resume the 10-minute schedule or general development from a docs/UI request. |
| DEC-015 | Repo-contained documentation replaces the unavailable external spec dependency. Accepted and merged in PR523; entry-point repair merged in PR525. | Existing entrypoints reference a missing sibling file; a recipient cannot reconstruct design from code alone. | Requirements, rationale, coverage, operations and work log live here. Preserve archaeology but do not make missing external files normative. |

## Open decisions, not hidden assumptions

- The maintainer selected **newadmin.vpsfree.cz** on 2026-09-29. Earlier
  newui/nextui/webui suggestions are superseded. Hostname selection and dedicated
  SSH public-key preparation do not establish completed DNS/TLS/OAuth setup or
  authorize a cutover. See the [cutover checklist](HANDOVER.md#newadmin-cutover).
- Default dev soft-delete retention needs a policy choice; frontend controls do
  not choose the duration for the service.
- Backend cursor compatibility/release path after rejection of PR44 is unresolved.
- KB publication strategy (parallel docs versus cutover), article ownership and
  review sign-off remain to be assigned.
- Independent audit owner/scope and release acceptance owner must be named for a
  full handover. Creating documentation does not appoint or complete an audit.
- Any older design rationale not supported by current history is unknown. Add a
  source or a new explicit decision rather than attributing assumptions to users.

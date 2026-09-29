# Requirement evidence matrix

Review baseline: UI/BFF `156a7c043e543b5f4a51fc962d16e31bd6eaa00f`, 2026-09-29.
This maps **all 67 register IDs**, including policy/non-runtime requirements. A
verification entry is a reproducible review starting point, **not** proof that
all acceptance criteria passed. A source link is not a test and a fixture does
not establish API behavior. For broad requirements use the linked action catalog
and the additional cases below, not just one representative test.

Implementation and historical delivery are recorded in [REQUIREMENTS.md](REQUIREMENTS.md).
Detailed current behavior is in [ACTION_CONTRACTS.md](ACTION_CONTRACTS.md).
Fresh commands and results for this documentation change are in its
[work log](../work-log/2026-09-29-documentation-handover.md). Historical whole-suite
counts must not be relabeled fresh tests of this branch. The latest recorded main
release CI is [static](https://github.com/Kerrycek/clankerdev/actions/runs/36342559547)
and [fixture browser](https://github.com/Kerrycek/clankerdev/actions/runs/36342559546).
Not every test file in this matrix necessarily ran in that PR-selected browser run.

## Requirement coverage

| Requirement | Verification entry | Acceptance focus | Evidence / implementation limitation |
| --- | --- | --- | --- |
| REQ-001 | [Roles and direct routes](../../e2e/specs/app/vps_support_permissions.spec.ts) | Role gates; owner/admin My scope | Source/test coverage identified; live permission matrix pending |
| REQ-002 | [Tab identity](../../e2e/specs/app/document_title.spec.ts) | Public/app/admin titles in cs/en | Delivered per linked PR |
| REQ-003 | [Legacy favicon asset](../../public/favicon.png) | Manual byte/build-asset comparison | Delivered per release receipt; no standalone favicon test |
| REQ-004 | [Normal labeled sidebar](../../e2e/specs/app/sidebar_active_nav.spec.ts) | Destination icons, active routes, labels; manual width review | Delivered per PR522 receipt |
| REQ-005 | [UI preference persistence](../../e2e/specs/app/ui_preferences_persistence.spec.ts) | Keyed PUT; reload/login/anonymous isolation | Fixture evidence; actual account persistence needs scoped live proof |
| REQ-006 | [Idle countdown](../../e2e/specs/app/header_session_limit.spec.ts) | Activity/idle timer and expiry display | Fixture evidence; do not infer idle from background polling |
| REQ-007 | [Token/session races](../../bff/README.md) | Refresh/logout serialization and single-process store boundary | BFF tests and source; no multi-worker guarantee |
| REQ-008 | [Page outline/focus](../../e2e/specs/app/route_focus_navigation.spec.ts) | Route/skip focus and preserved keyboard indicators | Delivered per PR506 |
| REQ-009 | [Locale/theme](../../e2e/specs/public/theme_language_bootstrap.spec.ts) | cs/en and anonymous theme bootstrap | Fixture evidence; complete contrast audit not recorded |
| REQ-010 | [Responsive accessibility](../../e2e/specs/app/modal_focus_trap.spec.ts) | Focus trap/restore; separately check mobile overflow | Partial coverage; toast overlap gate open |
| REQ-011 | [Rejected vs uncertain writes](../../e2e/specs/admin/requests_operations_smoke.spec.ts) | Known rejection retains form; ambiguous mutation locks retry | Exact scenario titles in critical-case table below |
| REQ-012 | [Async receipts](../../e2e/specs/app/action_state_detail_page.spec.ts) | Identity/progress and accepted vs completed | Fixture/source; completed real task evidence separate |
| REQ-013 | [Route identity](../../e2e/specs/app/detail_route_param_isolation.spec.ts) | Change ID/back/reload without stale draft | Fixture coverage |
| REQ-014 | [Distribution](../../e2e/specs/app/vps_header_system_summary.spec.ts) | Header OS identity and missing values | Delivered per PR513 |
| REQ-015 | [Runtime summary](../../e2e/specs/app/vps_header_system_summary.spec.ts) | Uptime/load/processes/CPU formatting | Delivered per PR513; metrics freshness remains API fact |
| REQ-016 | [Equal cards](../../src/pages/app/vps/VpsOverviewMetricsCard.test.tsx) | Card composition; visual desktop/mobile check | Delivered per PR515; DOM test alone not geometry proof |
| REQ-017 | [Compute and disk workspace](../../e2e/specs/app/vps_resource_workspace.spec.ts) | Independent drafts/saves, failed fresh disk read, used-space change | Source/test coverage; live resize requires synthetic target |
| REQ-018 | [Allocation override](../../e2e/specs/app/dataset_management_actions.spec.ts) | Explicit admin controls, no unrelated ZFS changes/member leak | Fixture payload proof; backend permission authoritative |
| REQ-019 | [Late create defaults](../../src/pages/app/vps/VpsCreatePage.test.ts) | Preserve edited resource values | Delivered per PR498 |
| REQ-020 | [Console entry](../../e2e/specs/app/vps_console_page.spec.ts) | Entry token request/reuse, retry/revoke boundaries | Delivered per PR517; fixture is not connected live console |
| REQ-021 | [Delete modes](../../src/pages/app/vps/VpsDeleteModel.test.ts) | Default lazy, no member flags, future expiry, hard ignores expiry | Fresh focused unit run in this docs PR; live deletion not rerun |
| REQ-022 | [Dev retention policy](../../docs/design/API_CONTRACTS.md) | Inspect prior receipt before repeat; choose actual policy | Open operator decision; not a passing test |
| REQ-023 | [Power/access/maintenance](../../e2e/specs/app/vps_lifecycle_tab_actions.spec.ts) | Capabilities, target review, busy/preflight and errors | Fixture/source; per-action live coverage pending reconciliation |
| REQ-024 | [Storage navigation](../../e2e/specs/app/storage_sections_contract.spec.ts) | VPS disks versus member NAS/backups | Delivered per PR491 |
| REQ-025 | [Heatmap eligibility](../../e2e/specs/admin/node_heatmaps.spec.ts) | Configured secure URL and node eligibility; no pre-open requests | Fixture/source |
| REQ-026 | [Icon-only heatmap](../../e2e/specs/admin/node_heatmaps.spec.ts) | Icon with localized accessible name | Delivered per PR521 receipt |
| REQ-027 | [Node history](../../e2e/specs/app/node_history.spec.ts) | Kernel/history view and scope | Delivered per PR493; backend paging scope separate |
| REQ-028 | [Infrastructure and migration](../../src/pages/app/vps/VpsAdminLifecycleModel.test.ts) | Timing/IP options/payload; plan gates separate | Baseline model verified; new picker accepted pending PR528 |
| REQ-029 | [Effective timezone](../../src/pages/app/admin/users/UsersModel.test.ts) | Account/server effective zone resolution | Source/test; never universal hardcoded Prague |
| REQ-030 | [Account-change metadata](../../src/pages/app/admin/RequestDetailPage.test.tsx) | Initially visible metadata in change detail | Source/test coverage |
| REQ-031 | [Registration metadata](../../e2e/specs/admin/requests_operations_smoke.spec.ts) | Applicant block contains initially open technical data | Delivered per PR516 |
| REQ-032 | [Risk placement](../../e2e/specs/admin/requests_operations_smoke.spec.ts) | Checks below applicant, mobile stacking | Delivered per PR508/512; visual reference linked separately |
| REQ-033 | [Wide applicant layout](../../e2e/specs/admin/requests_operations_smoke.spec.ts) | Width/grouping, no tall side decision card | Delivered per PR512 |
| REQ-034 | [Compact decision preference](../../e2e/specs/admin/requests_operations_smoke.spec.ts) | Small preference, following action row, queue outcome | Delivered per PR516 |
| REQ-035 | [Resolved reconsideration](../../src/pages/app/admin/RequestReviewActions.test.ts) | Every state and bulk distinction; orphaned owner | Fresh focused model tests; backend acceptance not implied |
| REQ-036 | [Risk/address failure](../../e2e/specs/admin/requests_operations_smoke.spec.ts) | Unknown/pending fraud, map retry/fallback | Fixture; actual geocoder lookup separate |
| REQ-037 | [Rejected map proposal](../../docs/design/DECISIONS.md) | DEC-005; PR435 rejected | Manual policy review, not runtime test |
| REQ-038 | [Review and correction](../../src/pages/app/admin/RequestReviewActions.test.ts) | State/reason/placement/bulk rules; public correction token separately | Baseline unit/source; localized presets pending PR529 |
| REQ-039 | [Live admin lifecycle](../../docs/design/VERIFICATION.md) | Persisted state, mail/action receipt, owner denial, cleanup | Open exact-candidate certification |
| REQ-040 | [Account/security/namespaces](../../e2e/specs/app/profile_keys_sessions.spec.ts) | Key/session operations; MFA/mail/namespaces have separate suites | Source/test inventory; domain completeness not a single test |
| REQ-041 | [Passkey auth origin](../../e2e/specs/app/profile_passkey_handoff.spec.ts) | Origin-bound handoff; no cross-origin bypass | Delivered per PR499 |
| REQ-042 | [User-data cursors](../../src/lib/api/vpsUserData.test.ts) | Owner/format/query payload; selected historical live scenario | Blocked; PR496 and agreed backend needed |
| REQ-043 | [IP history cursors](../../src/lib/api/ipAddresses.test.ts) | Assignment filter/order serialization | Blocked; PR507 does not prove deployed lossless traversal |
| REQ-044 | [Storage cursors](../../src/lib/api/datasets.test.ts) | Dataset/snapshot adapter serialization | Blocked; PR509 requires actual order agreement |
| REQ-045 | [Rejected backend work](../../docs/design/API_CONTRACTS.md) | PR44/242 excluded; PR43 only payments | Manual release-scope check |
| REQ-046 | [Cursor navigation](../../src/lib/hooks/useKeysetPagination.ts) | Tie filter/scope/history and back/reload | Source plus list fixture suites; open server-order gaps remain |
| REQ-047 | [Backup tabs/filters](../../e2e/specs/app/backup_center.spec.ts) | Preserve owner/location filters, late response races | Delivered per PR497 |
| REQ-048 | [Storage actions](../../e2e/specs/app/dataset_snapshot_confirm_workflows.spec.ts) | Create/rollback/delete/download, lost response, owner scope | Fixtures; actual restored contents require live proof |
| REQ-049 | [DNS contract](../../e2e/specs/app/dns_ttl_contract.spec.ts) | Inherited/null TTL and constraints; types use separate model suite | Fresh unit model verification; publication not rerun |
| REQ-050 | [Networking scope](../../e2e/specs/app/vps_network_destructive_feedback.spec.ts) | Detach target, address family/owner and retained error | Fixture coverage; assignment cursor blocker independent |
| REQ-051 | [Operations surfaces](../../e2e/specs/app/transaction_chain_detail_page.spec.ts) | Chain/item/action distinction; monitoring/OOM separate cases | Source/test inventory; no whole-domain live certification |
| REQ-052 | [Finance gates](../../e2e/specs/app/admin_user_finance_role.spec.ts) | Role denial for global/user finance; assignment/bulk tests separate | Fixture/source |
| REQ-053 | [Mail/content](../../e2e/specs/admin/mailer_template_crud_safety.spec.ts) | Safe template preview, errors; recipients/handlers separate suites | Fixture/source; real outbound mail not sent |
| REQ-054 | [Public information](../../e2e/specs/public/overview.spec.ts) | Anonymous status, denied private data, error/unknown distinction | Historical anonymous checks; no fresh deployment check |
| REQ-055 | [Advisory/audit](../../e2e/specs/app/security_advisories_admin.spec.ts) | Privileged advisory controls and relations; audit scope separate | Fixture/source |
| REQ-056 | [Independent live pins](../../docs/design/VERIFICATION.md) | Exact UI/API pair, synthetic objects, receipts and cleanup | Some operator-held prior proof; handover reconciliation open |
| REQ-057 | [KB integration](../../docs/design/HANDOVER.md) | Bindings, reviewed text, real cs/en captures, original evidence | Open beta minimum; cross-repo review required |
| REQ-058 | [Toast/Cancel overlap](../../docs/design/VERIFICATION.md) | Mobile error must not obscure cancellation | Open targeted fix/verification; no PASS asserted |
| REQ-059 | [Session audit contract](../../bff/server.js) | accessToken/sessionKey/sessionExpiresAt and null anonymous values | Runtime source checked; all live audit consumers not certified |
| REQ-060 | [Release acceptance](../../docs/design/HANDOVER.md) | Exact candidate, exclusions, evidence/rollback, explicit approval | Open beta acceptance, not closed by docs checks |
| REQ-061 | [CI integrity](../../scripts/design-docs.test.mjs) | Negative cases remain enforced; no baseline loosening | Fresh focused and script-suite results in work log |
| REQ-062 | [Isolated changes](../../AGENTS.md) | Preserve main edits, scoped branch and bilingual PR | Manual git diff/status review |
| REQ-063 | [Authorization/automation](../../docs/design/DECISIONS.md) | No merge/deploy from docs approval; background work paused | Manual scope check |
| REQ-064 | [Docs/work-log handover](../../docs/design/DOCUMENTATION_REVIEW.md) | Audit dispositions, receipts, requirements/evidence and owner checklist | This PR; receiver acceptance remains explicit |
| REQ-065 | [Independent security audit](../../docs/design/HANDOVER.md) | Named reviewer, scope, findings and decisions | Open; this self-review is not independent security audit |
| REQ-066 | [Hostname and publication](../../docs/design/HANDOVER.md) | newadmin selected; DNS/TLS/OAuth/access/KB cutover gates | Hostname accepted; cutover not performed |
| REQ-067 | [Issue-runner trust](../../deploy/ai-issue-runner/README.md) | Kerrycek/active vpsfreecz; outsider approval bound to content | PR526 receipt; no new model invocation for verification |

## Critical acceptance cases

Use these exact case titles/selectors to find the expected assertion, then check
that the scenario still matches the changed API/UI. Fixture names containing
"live contract" still use intercepted responses unless explicitly run against a
real pinned API. Each live proof must include owner/role, UI/API pins, outcome
and cleanup. Ongoing policy rows are reviewed manually rather than forced into
meaningless tests.

| Requirement | Case / expected result | Concrete suite |
| --- | --- | --- |
| REQ-035 / REQ-038 | State matrix includes approved/denied/ignored/pending_correction; unknown/non-admin denied; bulk registration approval excluded | [RequestReviewActions](../../src/pages/app/admin/RequestReviewActions.test.ts) |
| REQ-011 / REQ-038 | "stale detail is rechecked immediately before resolve"; no stale mutation | [request browser](../../e2e/specs/admin/requests_operations_smoke.spec.ts) |
| REQ-011 / REQ-038 | "ambiguous bulk mutation stops before untouched targets"; no automatic replay | [request browser](../../e2e/specs/admin/requests_operations_smoke.spec.ts) |
| REQ-017 / REQ-018 | "preserves the other draft when saving"; independent compute/disk saves | [workspace](../../e2e/specs/app/vps_resource_workspace.spec.ts) |
| REQ-017 | "fails closed when a fresh disk read fails or used space has increased" | [workspace](../../e2e/specs/app/vps_resource_workspace.spec.ts) |
| REQ-021 | "never sends administrative options in member view"; custom deadline only for future soft delete | [delete model](../../src/pages/app/vps/VpsDeleteModel.test.ts) |
| REQ-028 | "builds cross-environment migration payload with IP and custom schedule options"; "resets IP flags and scheduling for same-location migrations" | [migration model](../../src/pages/app/vps/VpsAdminLifecycleModel.test.ts) |
| REQ-048 | "an applied rollback outside recent history with a lost response cannot be posted twice" | [snapshots](../../e2e/specs/app/dataset_snapshot_confirm_workflows.spec.ts) |
| REQ-048 | "sends only quota fields and preserves untouched advanced properties on update"; foreign create deep-link denied | [dataset mutations](../../e2e/specs/app/dataset_management_actions.spec.ts) |
| REQ-049 | Record TTL blank create vs null update, 60–604800; MX/SRV priority, A/AAAA dynamic updates and supported content types | [TTL](../../src/pages/app/dns/dnsTtlContract.test.ts), [record model](../../src/pages/app/dns/DnsRecordModel.test.ts) |
| REQ-052 | Role gates and partial bulk assignment reconciliation | [finance gates](../../e2e/specs/app/admin_user_finance_role.spec.ts), [bulk](../../e2e/specs/app/admin_incoming_payments_bulk_reconciliation.spec.ts) |

## Pending branch evidence

- **PR528**, `94784cf4c93253bc8996f7b15b8dbfe3e96b0899`:
  [static CI](https://github.com/Kerrycek/clankerdev/actions/runs/36359596240),
  [browser CI](https://github.com/Kerrycek/clankerdev/actions/runs/36359596147).
  Its migration tests cover 60 destinations, bounded dropdown/search, keyboard,
  retained selection, payloads and errors. Fixture proof only; no live migration.
- **PR529**, `169ad7fac8d8daab8d6d96d1e561dd2877915f0e`:
  [static CI](https://github.com/Kerrycek/clankerdev/actions/runs/36358609408),
  [browser CI](https://github.com/Kerrycek/clankerdev/actions/runs/36358609409).
  Preset tests cover reason bodies, editable/custom text, language resolution and
  submitted payload in cs/en. No email was actually delivered by these tests.
- **PR496/507/509**: do not treat green fixture CI as resolution of backend ordering.
  Their integration needs a newly agreed API pin and adversarial multi-page proof.

## Evidence transfer and retention

For each actual live scenario, store a sanitized receipt containing: scenario ID,
exact UI/API pins, date, role, locale/viewport, synthetic-object provenance,
command/test revision, accepted operation ID, final state and cleanup outcome.
Do not publish cookies, tokens, real applicant data or raw private traces.

The receiving operator must get access to the restricted artifact archive and
verify hashes/retention with its custodian. Prior private VM evidence is not
silently certified here; [HANDOVER.md](HANDOVER.md) names the transfer tasks and
explicitly unassigned owners. Test links remain useful even if an old CI artifact
has expired, but a reproducible test is not a replacement for a claimed past run.

# Action contracts and legacy coverage

Reviewed frontend: `156a7c043e543b5f4a51fc962d16e31bd6eaa00f`, 2026-09-29.
Pending additions are explicitly labeled. These are client behavior contracts,
not new permissions granted to the server. Requirements retain their IDs in the
[register](REQUIREMENTS.md); the [evidence matrix](EVIDENCE_MATRIX.md) links tests.
This catalog complements the route inventory with user actions; neither document
claims that every field of every legacy screen has been independently certified.

## Common rules

- **Member** means an authenticated owner in My view. **Admin** means admin
  capability in the appropriate view; a role and a selected view are separate.
  Support is a backend capability, not a third product mode. Finance and request
  review remain admin-only. The API is always the authorization boundary.
- A fresh target/state check precedes guarded writes. A rejected request retains
  the draft and error. Transport ambiguity or missing required receipt blocks a
  blind retry; inspect Tasks and object state first.
- Accepted/queued is distinct from completed. A target disappearing after a
  successful asynchronous create is not necessarily a failed create.
- Mutations, lists and controls inherit cs/en, keyboard/focus, mobile and dark/light
  requirements. Source reads are not live certification.
- IDs, ownership, state and inputs reviewed by the user must match the submitted
  request. Late data cannot overwrite an edited draft or change its target.

## Request review

REQ-030–039, 053. Sources:
[review model](../../src/pages/app/admin/RequestReviewModel.ts),
[target checking](../../src/pages/app/admin/RequestDetailModel.ts),
[resolve mutation](../../src/pages/app/admin/RequestResolveMutation.ts).
Tests: [state/role/bulk rules](../../src/pages/app/admin/RequestReviewActions.test.ts),
[browser review](../../e2e/specs/admin/requests_operations_smoke.spec.ts),
[orphaned owner](../../e2e/specs/admin/orphaned_change_request_owner.spec.ts).

### State and action matrix

This table describes **offered client actions**, subject to fresh API validation
and ownership/linked-user/busy checks. It does not promise the backend will accept
every reconsideration or create another account.

| Record and state | Individual admin detail | Bulk review |
| --- | --- | --- |
| Registration awaiting | Approve, deny with reason, ignore without response, request correction with reason | Deny, ignore, correction; no bulk approval |
| Registration approved | Deny, ignore, correction | None |
| Registration denied | Approve, ignore, correction | None |
| Registration ignored | Approve, deny, correction | None |
| Registration pending_correction | Approve, deny, ignore | None |
| Account change awaiting, linked user exists | Approve, deny, ignore | Same actions |
| Account change in any resolved state | None | None |
| Unknown state, missing record, non-admin | None | None |
| Account change without a valid linked user | None | None |
| Registration with historical raw_user_id but no valid linked user | None | None |
| New registration without any existing-user identity | Normal state rules | Normal state rules |

Deny and correction require a reason; approve and ignore do not. A resolved action
matching the current state is never offered. Bulk processing admits awaiting,
unlocked eligible records only. Known per-row rejection leaves failed targets
selected; ambiguity stops before untouched targets. Switching action cannot leak
the previous action's reason. Default work queue is awaiting; correction/all-state
queues are explicit and represented in the URL.

Detail preflight verifies exact request ID, subtype and expected state, since the
backend Show endpoint alone does not prove subtype. Unknown lookup failure is
retryable, not a “not found” fact. Optional queue advancement happens only after the
known successful outcome and follows the retained preference.

### Applicant information and correction fields

Applicant details includes login, full name, organization/name identifier, email,
address/map text fallback, year of birth, referral/how, note, OS template, location,
currency, language and timezone. Technical IP/time/operational metadata starts
open in the applicant block. Risk summaries follow that information, never an
unrelated right sidebar; incomplete/failed checks are not green success.

Approve/correction can expose supported overrides. For account changes the subset
is full name, email, address and change reason; comparing old/requested values
must distinguish clearing a value, an unchanged value and an unavailable old value.
Explicit placement requires client metadata proving template/node cgroup
compatibility (known v1/v2 or supported any); API placement remains authoritative.
A proposed payload or checked checkbox is not proof that a member was created,
a mail delivered, or the account changed.

### Pending registration messages

Accepted intent in [PR529](https://github.com/Kerrycek/clankerdev/pull/529), head
`169ad7fac8d8daab8d6d96d1e561dd2877915f0e`; **not in this source baseline**.

| Action | Presets |
| --- | --- |
| Rejection | Nonexistent address; incorrectly completed application (complete generic explanation, no additional detail required); duplicate application; existing membership |
| Correction | Incomplete address; unverifiable address (check/correct it or optionally send a map link marking the house); missing/incomplete name |

All seven provide editable full cs/en messages. Applicant language, not admin UI
locale, chooses the body. Numeric language IDs resolve through the catalog.
Unknown language requires an explicit preset-language selection; free text remains
available. Edited/custom text is not silently translated or overwritten. Changing
correction language updates an untouched preset. Existing resolve request sends
the reviewed reason; no second client email operation is added. Bulk/account-change
reasons retain existing free-text behavior.

## VPS and resources

REQ-014–024. Sources:
[VPS API](../../src/lib/api/vps.ts),
[configuration model](../../src/pages/app/vps/VpsConfigurationModel.ts),
[delete model](../../src/pages/app/vps/VpsDeleteModel.ts).
Tests: [resource workspace](../../e2e/specs/app/vps_resource_workspace.spec.ts),
[lifecycle actions](../../e2e/specs/app/vps_lifecycle_tab_actions.spec.ts),
[support permissions](../../e2e/specs/app/vps_support_permissions.spec.ts).

| Action | Required behavior and failure boundary |
| --- | --- |
| Create | Placement/template/resource selection, owner context and reviewed inputs; async defaults never overwrite edits. Bind pending create navigation to returned VPS/action-state identity. |
| Inspect | Distribution, node/location, SSH and uptime/load/process/CPU facts visible; unknown values stay unknown. Equal-width overview cards; graphs load on demand. |
| Start/stop/restart | Review actual target; honor active transaction/busy and role checks; distinguish force operations and retain failure feedback. |
| Compute/hostname edit | Review changed fields and exact target; preserve failed values and untouched controls. Admin allocation override is explicit, default off. |
| Root dataset resize | Separate disk save from compute; admin-only in this workspace including admin My view. Re-read disk activity and used space; do not shrink below observed use or proceed after failed fresh read. Saving compute cannot discard disk draft and vice versa. |
| Console | Entering page creates/reuses a session in a bounded flow; no infinite token retries. Revoke/replace is intentional; support restrictions remain independently tested. |
| Network/access/features | Preserve password/SSH/feature gates, addresses/interfaces/resolver and destructive detach confirmation. A hidden menu is not sufficient enforcement. |
| Reinstall/clone/rescue/replace | Distinct target/template/placement/lifetime/start semantics; preserve permissions and confirmation, never infer they are all equivalent to migration. |
| Delete | Use the mode table below, preserve receipt and tasks link, never treat a missing receipt as completion. |

### Deletion modes

| Caller/mode | Request | Validation and meaning |
| --- | --- | --- |
| Member/default | DELETE /vpses/{id}, no admin options | Normal API deletion policy; UI cannot choose missing backend retention |
| Admin soft, default deadline | DELETE /vpses/{id}, lazy=true | Default is soft/lazy; actual retention comes from backend policy |
| Admin hard | DELETE /vpses/{id}, lazy=false | Disregard leftover custom-expiry input; privileged destructive path |
| Admin soft, custom deadline | PUT /vpses/{id}, object_state=soft_delete, expiration_date ISO timestamp, change_reason=Deletion requested | Future valid local datetime converted to ISO; one lifetime transition, never delete-then-update |

Source: [vpsDelete](../../src/lib/api/vps.ts), tests:
[delete options](../../src/pages/app/vps/VpsDeleteModel.test.ts),
[API payloads](../../src/lib/api/vps.test.ts).
Confirmation identifies hostname or #id fallback. Busy/uncertain protection still
applies. Dev's missing default retention is an unresolved configuration policy,
not a missing frontend expiry field. Changing that policy requires its own approval.

## Migration

REQ-028. Source:
[legacy-compatible form model](../../src/pages/app/vps/VpsAdminLifecycleModel.ts),
[tests](../../src/pages/app/vps/VpsAdminLifecycleModel.test.ts).
Migration is privileged; the known source VPS/node is context, not a second
user-selected source. Destination compatibility and capacity remain server decisions.

| Input | Default / serialized contract |
| --- | --- |
| Destination | Required positive node ID; source-node exclusion is added by pending PR528, not guaranteed by the baseline lookup |
| Timing | maintenance by default; now sends maintenance_window=false without custom finish fields |
| Custom completion | Selected weekday and hour required; hour 0–23 converted to finish_minutes=hour*60; preserve the UI/API weekday convention, do not infer a timezone conversion |
| Transfer IPs | Applicable only when both environments are known and differ |
| Replace IPs | Applicable only when both locations are known and differ |
| Inapplicable IP flags | Serialized false; unknown metadata is not a guarantee of preserving addresses |
| Destination change | Clears confirmation; resets unavailable IP choices; timing becomes now across applicable location/environment changes, otherwise maintenance |
| Error/cleanup/mail | stop_on_error=true, cleanup_data=true, send_mail=true initially |
| Startup | no_start=false and skip_start=false initially; distinct API options, do not collapse them |
| Reason | Optional, trimmed; omitted when empty |
| Confirm | Bound to actual VPS, destination and submitted values; edits invalidate it |

Current baseline uses the earlier lookup/advanced layout. Accepted pending
[PR528](https://github.com/Kerrycek/clankerdev/pull/528), head
`94784cf4c93253bc8996f7b15b8dbfe3e96b0899`, replaces it with a click-to-open
searchable dropdown, 256px bounded scroll list, hostname/location/environment
labels, current-node exclusion and complete active-hypervisor ID-cursor paging.
No partial inventory is presented as complete. Keyboard selection/Escape, focus
restoration and preserved selection are required. Reason/timing/applicable IP and
execution controls remain visible. The earlier always-open radio-card design is
superseded. Sixty synthetic nodes are covered in its fixture cases; that is not a
completed real migration.

Migration plans remain separate: create plan, add migrations, list entries,
start/cancel/delete, each with busy/preflight and partial-failure handling.
[Plan API](../../src/lib/api/migrations.ts),
[plan gates](../../e2e/specs/admin/migration_plan_action_gating_busy_transaction.spec.ts).

## DNS and networking

REQ-049/050. Sources:
[record model](../../src/pages/app/dns/DnsRecordModel.ts),
[TTL contract](../../src/pages/app/dns/dnsTtlContract.ts),
[API](../../src/lib/api/dns.ts).
Tests:
[TTL](../../e2e/specs/app/dns_ttl_contract.spec.ts),
[record capabilities](../../e2e/specs/app/dns_record_type_capabilities.spec.ts),
[record model](../../src/pages/app/dns/DnsRecordModel.test.ts).

| Rule | Reviewed client contract |
| --- | --- |
| Record types | A, AAAA, CAA, CNAME, DS, MX, NS, PTR, SRV, SSHFP, TLSA, TXT |
| Record TTL | Empty inherits zone; explicit integer 60–604800 seconds. Zero/negative/fractional/out-of-range input invalid. |
| Empty TTL on create | Omit override; on update send null to clear it. Omission on update would retain old value. |
| Zone default | 3600 seconds initial default; required TTL validation uses the same range |
| Priority | Required integer 0–65535 for MX/SRV; unsupported for other types |
| Dynamic updates | A/AAAA only; unsupported choice cannot survive type switching |
| Record identity | Create carries zone/name/type; ordinary update carries editable values, not a record rename/type change |
| Names | Required, <=253 chars; labels <=63, no spaces/empty labels; @ apex and leading *. supported by client. Trailing dot is warned. |
| Address/target content | A/AAAA checked as address; CNAME/MX/NS/PTR require hostname-like target, not URL |
| CNAME | Conflicts with another record at same normalized name; apex is warned. Duplicate record warns. These checks inspect loaded records; API is authoritative for unloaded conflicts. |
| DS/SSHFP/TLSA | Validate component structure and digest/fingerprint lengths; DS at @ rejected by client |
| SRV/CAA/TXT | SRV weight/port/target format, CAA flag/tag/value; incomplete hostname-only SRV and long TXT produce warnings where coded, not invented universal rejection |
| Secret material | TSIG/dynamic URLs scrubbed from diagnostics; masked display does not authorize leaking raw responses |
| Saved vs published | Saved API response is not proof of authoritative DNS publication; follow chain and query the isolated nameserver for live evidence |

Zone lifecycle, server relations, transfer permissions, logs, DNSSEC and TSIG have
separate APIs and confirmation/error states. Do not reuse record deletion for a zone
or relation. Member-owned DNS scope and administrator infrastructure scope differ.
[Relation failures](../../e2e/specs/app/dns_relation_delete_failures.spec.ts),
[zone deletion](../../e2e/specs/app/dns_zone_delete.spec.ts),
[zone API](../../src/pages/app/dns/DnsZoneModel.ts).
IP inventory, suggested-free addresses, exact assignment filters, routing and
resolver changes preserve owner/environment/address-family scope. Assignment
history lossless pagination remains blocked by REQ-043; an ID cursor alone does
not resolve timestamp ordering.

## Storage, NAS, snapshots and exports

REQ-017/018/024/044/047/048. Sources:
[datasets](../../src/lib/api/datasets.ts), [exports](../../src/lib/api/exports.ts),
[mounts](../../src/lib/api/vpsMounts.ts). Tests:
[dataset mutations](../../e2e/specs/app/dataset_management_actions.spec.ts),
[snapshot workflows](../../e2e/specs/app/dataset_snapshot_confirm_workflows.spec.ts),
[backup center](../../e2e/specs/app/backup_center.spec.ts).

| Action | Contract to preserve |
| --- | --- |
| Dataset/NAS/subdataset create | Member can create an owned subdataset through supported path; reject foreign parent deep links. Administrator properties are not sent by member forms. |
| Quota/property edit | Send only edited quota/ZFS properties. Missing admin properties are not fabricated as defaults. Explicit allocation override and related controls remain privileged. |
| Dataset delete | Confirm actual owned target and fresh activity; busy transaction prevents a second destructive operation. |
| Snapshot create | Optional label, receipt opens action progress; absence of a dataset state field alone is not proof that every operation is forbidden |
| Snapshot rollback | Destructive confirmation; a lost response cannot be retried solely because operation is absent from a limited recent-history page |
| Snapshot delete/download | Confirm deletion; download creation can be queued before URL is ready. Owners retain permitted snapshot actions. |
| Local/remote restore | Identify actual source pool/snapshot and destination; track transfer/restore, verify recovered synthetic content and cleanup for live proof |
| Plans/expansion | Distinguish assigning/removing a plan from allocating expansion, adjusting space and inspecting expansion history |
| Export/hosts | NFS/export relationship and host permissions, target-specific confirmation and retained failure; mount lists remain in VPS storage |
| Backup filtering | Preserve owner/location and other applicable filters across tab changes |
| Pagination | REQ-044 remains blocked on actual server ordering; fixtures do not establish no-loss traversal |

Dataset admin controls can be hidden for admin My view while the explicitly
privileged root-disk workspace remains available. Do not replace action-specific
gates with one generic “admin sees everything” rule.

## Remaining domain action inventory

These are preservation requirements grounded in current routes/adapters and linked
tests, not invented historical user requests. The evidence matrix provides a
verification entry for every associated requirement. Full legacy field-by-field
parity for these domains is **unverified**; request a service maintainer's review
of intentionally missing actions before declaring parity.

| Domain / requirements | Actions and distinctions | Verification entry |
| --- | --- | --- |
| Auth/session, REQ-005–007/009/041/059 | OAuth login/callback/logout, token rotation, same-origin session JSON, human-activity expiry, theme/settings persistence, origin-bound passkey handoff | [preferences](../../e2e/specs/app/ui_preferences_persistence.spec.ts), [expiry](../../e2e/specs/app/session_expiry_redirect.spec.ts), [BFF](../../bff/README.md) |
| Account, REQ-029/040 | Profile request vs direct settings, security/MFA/recovery, SSH keys/devices/sessions, metrics tokens, mail preferences, namespaces and user-data. Keep secret handling, owner scope and failed drafts. | [MFA](../../e2e/specs/app/profile_mfa_recovery.spec.ts), [keys/sessions](../../e2e/specs/app/profile_keys_sessions.spec.ts), [profile](../../e2e/specs/app/profile_overview_account.spec.ts) |
| User administration, REQ-039/040 | Inspect identity/resources, edit account status/lifetime/reminders, environment limits/packages and security flags. Separate permission checks, fresh state and supported transitions. | [user detail](../../e2e/specs/admin/user_detail_page.spec.ts), [resources](../../e2e/specs/admin/user_resources.spec.ts) |
| Finance, REQ-052 | Member payment list; admin incoming assignment, unassignment/review queue, bulk reconciliation, forecasts, payment history/instructions. User and global finance gates independent. | [assign](../../e2e/specs/app/admin_incoming_payment_assign.spec.ts), [bulk](../../e2e/specs/app/admin_incoming_payments_bulk_reconciliation.spec.ts), [role](../../e2e/specs/app/admin_user_finance_role.spec.ts) |
| Tasks/transactions, REQ-012/051 | Action state vs chain vs item; pending/running/failed/finished, scope-isolated persisted local locks, manual reconciliation after unknown outcome | [task isolation](../../e2e/specs/app/task_storage_scope_isolation.spec.ts), [chain](../../e2e/specs/app/transaction_chain_detail_page.spec.ts) |
| Monitoring/incidents/OOM, REQ-051 | Event decisions, incident creation permissions, report detail, cgroups, rules, tasks, statistics and filters; long identifiers on mobile | [event feedback](../../e2e/specs/app/monitoring_event_action_feedback.spec.ts), [incident gates](../../e2e/specs/app/incident_create_permissions.spec.ts), [OOM](../../e2e/specs/app/oom_report_tasks_mobile_layout.spec.ts) |
| Nodes/cluster, REQ-025–028 | Node status/kernel/history, pool maintenance, environments/locations, templates/packages/resources, resolvers/networks/system configuration; support/member visibility separate from writes | [node control](../../e2e/specs/admin/node_detail_control_center.spec.ts), [cluster](../../e2e/specs/admin/cluster_resource_maintenance.spec.ts) |
| Mail/content, REQ-053 | Template and translation CRUD, safe HTML preview, recipients, mailboxes, handler ordering, mail log, news/help boxes. Reorder partial outcomes cannot be retried blindly. | [template safety](../../e2e/specs/admin/mailer_template_crud_safety.spec.ts), [handlers](../../e2e/specs/admin/mailer_mailbox_handler_feedback.spec.ts), [content](../../e2e/specs/admin/admin_content_delete_feedback.spec.ts) |
| Advisories/audit/public, REQ-054/055 | Anonymous status/news/outages/advisories, privileged advisory/update/node/outage relations, rebuilds and audit history. Failed public API is not all-healthy. | [public overview](../../e2e/specs/public/overview.spec.ts), [advisories](../../e2e/specs/app/security_advisories_admin.spec.ts), [audit](../../e2e/specs/admin/audit_smoke.spec.ts) |
| KB, REQ-057 | Page bindings/articles/captures with independent UI/API pins and synthetic accounts; preserve legacy evidence; publication separate | [open handover items](HANDOVER.md#acceptance-and-ownership) |

## Legacy and acceptance boundary

| Classification | Known examples | Consequence |
| --- | --- | --- |
| Restored and fixture-covered | Allocation overrides, distribution/runtime header, soft/hard/custom delete, resolved-registration actions, heatmaps | Preserve concrete rules above; runtime/live proof has its own scope |
| Deliberately superseded UX | Registration risk sidebar, 176px navigation proposal, extra console-start click, opt-in applicant map proposal | Do not restore historical layouts as “legacy parity” |
| Accepted but pending | Dropdown migration selection and localized response presets | Review exact PR heads; do not label deployed |
| Blocked API contract | User-data, assignment history, dataset/snapshot cursors | Keep PR496/507/509 excluded pending a newly agreed backend contract |
| Not independently certified | Exhaustive old-UI action/field coverage and exact-candidate live lifecycle | Receiver reviews this explicit gap; a route count cannot close it |

When a missing legacy action is found, add its exact action, role, preconditions,
payload/units and acceptance example to the affected contract and requirement.
Separate implementation defects from deployment configuration and missing evidence.

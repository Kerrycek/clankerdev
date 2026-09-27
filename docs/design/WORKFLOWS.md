# Workflow catalog and behavior to preserve

This catalog covers all product domains in the current route/API inventory. It is
not a claim of exhaustive field-level legacy parity. Each workflow inherits the
role/scope, localization, focus, draft/error and uncertain-write rules from
[product design](PRODUCT_DESIGN.md) and [architecture](ARCHITECTURE.md).

Source links identify implementation for inspection, not a substitute for test
results. Every endpoint field remains governed by [API contracts](API_CONTRACTS.md).
The [generated inventory](IMPLEMENTATION_INVENTORY.md) covers exact route variants,
layouts, aliases and imported finance/advisory gates.

## Public entry and authentication

**Intent:** inspect service availability, sign in, recover access or correct a
registration without exposing private information. Public overview combines
cluster/node status with outages/news/advisories; external heatmaps are optional.
OAuth login/callback/logout preserve a safe return destination and display errors.
Password recovery uses the configured provider flow. Token-scoped registration
correction exposes only the request allowed by that token.

**Failure contract:** public API failure is not “all healthy”; unavailable heatmaps
must not break node lists. Auth callback errors offer a way back. Expiry redirects
preserve safe navigation context and do not loop. Check session JSON separately
from SPA fallback. [Routes](../../src/routes/router.tsx),
[public adapter](../../src/lib/api/public.ts), [BFF docs](../../bff/README.md).

## VPS creation, detail and power

**Intent:** choose placement/template/resources, create a VPS, inspect identity and
runtime status, and manage it. Creation defaults are suggestions; async updates
cannot overwrite entered resources. Member scope stays owned; admins can explicitly
use the appropriate wider view. Header distribution/runtime facts and equal-width
cards make common diagnostics available without a second screen.

**Actions:** start, stop/restart and supported power/lifecycle operations must name
the target and honor live state/transaction locks. Creation and power requests may
be asynchronous. Preserve action-state links and reconcile uncertain submissions
before a second attempt. [VPS adapter](../../src/lib/api/vps.ts),
[power failure fixture](../../e2e/specs/app/vps_power_failures.spec.ts).

## Compute, disk, access, network and maintenance

**Intent:** edit compute and root disk in a coherent workspace, configure hostname,
access, features, interfaces and supported maintenance actions. Compute and dataset
changes have separate backend boundaries: do not promise an atomic combined save.
Admin allocation overrides are explicit and never silently enabled for members.

**Failure contract:** retain reviewed values and identify which operation failed.
Refresh affected facts after known acceptance, but do not reset unrelated input.
Role/state restrictions remain on direct routes. Root usage/quota checks and server
validation determine allowed shrinking/growing; the UI does not manufacture free
resources. [Access](../../src/lib/api/vpsAccess.ts),
[features](../../src/lib/api/vpsFeatures.ts), [mounts](../../src/lib/api/vpsMounts.ts),
[maintenance](../../src/lib/api/vpsMaintenance.ts),
[resource fixture](../../e2e/specs/app/vps_resource_workspace.spec.ts).

## Console and VPS deletion

**Intent:** entering Console opens a session directly; intentional replacement and
revocation remain explicit. Opening a page must not spawn an uncontrolled retry
loop after a failed token request. Secure console URLs are required.

Deletion separates standard member removal from admin soft/hard options and
optional custom retention. Review target and mode; show a durable accepted-request
receipt and Tasks link. An accepted request may still fail later. Hard mode cannot
accidentally inherit a soft expiry. Dev's missing default retention remains a
backend configuration decision. [Console fixture](../../e2e/specs/app/vps_console_page.spec.ts),
[PR518](https://github.com/Kerrycek/clankerdev/pull/518).

## Storage, NAS, snapshots, backup and export

**Intent:** inspect datasets and usage/quota, create NAS storage, manage snapshots,
schedules/plans and downloads, export datasets and restore from available backups.
VPS root disks remain in VPS detail; member NAS and Backup Center retain separate
navigation. Backup filters remain stable across tab changes.

**Restore contract:** identify source snapshot/pool and destination; distinguish
local from replicated/remote restore. Track transfer/restore chains to an actual
outcome before calling the data recovered. Live evidence needs synthetic content
and cleanup, not only a completed UI task. Download/export URLs and permissions
must not leak to unrelated owners. Snapshot/list pagination retains the documented
backend blocker. [Datasets](../../src/lib/api/datasets.ts),
[exports](../../src/lib/api/exports.ts), [backup fixture](../../e2e/specs/app/backup_center.spec.ts).

## DNS and networking

**Intent:** create/edit zones and records, configure transfers, servers, TSIG and
DNSSEC, inspect logs, and manage relevant IP/interface/resolver resources.
Administrators also have network/address inventories and allocation operations.

**Success contract:** UI save and DNS publication are separate evidence. Real
publication tests query the actual isolated DNS service after the transaction.
Respect supported record types, TTL and payload fields; preserve zone context on
errors. Secret-bearing keys must be scrubbed from diagnostics. IP assignment
history must not lose entries due to a false cursor assumption.
[DNS](../../src/lib/api/dns.ts), [transfers](../../src/lib/api/dnsTransfers.ts),
[interfaces](../../src/lib/api/networkInterfaces.ts), [IP history](../../src/lib/api/ipAddresses.ts).

## Account profile and user administration

**Intent:** members manage profile, mail/security preferences, keys, sessions, MFA,
metrics, user-data and namespaces. Administrators inspect/update users, resource
usage/packages, environment configuration, finances and account states as allowed.
Effective timezone is explicit. User login/timezone/filesystem-related legacy
controls must not disappear during layout simplification.

**Risk contract:** distinguish security-sensitive changes from ordinary preferences;
confirm disabling MFA/deleting keys/sessions, preserve failures, never log secrets.
Passkey setup belongs to the authentication origin. Profile edits may create a
review request rather than directly change the account; the receipt/status must
explain that. [Users](../../src/lib/api/users.ts),
[user accounts](../../src/lib/api/userAccounts.ts), [namespaces](../../src/lib/api/userNamespaces.ts),
[user-data](../../src/lib/api/vpsUserData.ts).

## Applications, profile changes and review queues

**Intent:** inspect a request's applicant data, technical metadata and risk checks,
then approve, reject with a response, close without response or request correction
where the API state permits. A queue can start from the selected item; moving to
the next item is controlled by the compact preference. Resolved registrations can
be reconsidered through supported transitions, not an arbitrary status picker.

**Failure contract:** preserve the current decision draft, stale/missing owner
errors, and uncertain-operation guard. Already-created accounts/terminal states
must not be duplicated. Test persisted backend state and notification/action-state
outcome with synthetic accounts before claiming full lifecycle certification.
[Request model](../../src/pages/app/admin/RequestDetailModel.ts),
[resolution mutation](../../src/pages/app/admin/RequestResolveMutation.ts),
[requests API](../../src/lib/api/requests.ts).

## Payments and finance

**Intent:** members inspect their payments; admins assign/review incoming payments,
manage account-related finance, history and forecasts. The Finance menu opens
incoming payments as the common working destination. Global finance and sensitive
user payment views have explicit administrator gates even if a support-level user
can access other admin pages.

**Failure contract:** amounts/currency/timezone/scope must stay bound to the reviewed
transaction. Failed assignment remains in review; queue advances only on the known
appropriate outcome. Partial/bulk outcomes require reconciliation rather than
blind retry. [Finance](../../src/lib/api/finance.ts),
[payments](../../src/lib/api/payments.ts), [gated routes](../../src/routes/adminFinanceRoutes.tsx).

## Tasks, transactions, monitoring, incidents and OOM

**Intent:** inspect asynchronous action states/chains/items, monitoring events,
incident reports and memory-exhaustion reports/rules/tasks/stats. These explain
why an object is busy and whether an operation succeeded.

**Contract:** action state, transaction and object state are related but not
interchangeable. Unknown/stale locks must be shown as such. Users see permitted
objects; session filters and pagination must retain context. Large cgroup/SSH/task
identifiers must wrap or scroll appropriately on mobile. Monitoring decisions and
incident creation keep failed submissions retryable where safe.
[Transactions](../../src/lib/api/transactions.ts),
[monitoring](../../src/lib/api/monitoring.ts), [incidents](../../src/lib/api/incidents.ts),
[OOM](../../src/lib/api/oom.ts).

## Nodes, cluster and migrations

**Intent:** inspect node status, kernel/system history and configured versions;
admins manage node/cluster/network/resource settings and migration plans.
Heatmap availability follows legacy config/type/maintenance rules. Expose useful
member visibility without granting infrastructure writes.

**Per-VPS migration (REQ-028):** show a compact destination selector. Clicking it
opens a height-bounded, scrollable list of active hypervisors with hostname, location
and environment, plus a text filter for those labels. Selecting a destination closes
the list; the selected name and metadata stay visible. Support keyboard selection,
Escape cancellation and retained selection when searching. This supersedes the
initial always-visible radio-card layout after the maintainer highlighted clusters
with dozens of nodes. The source node is excluded. Read all ID-cursor pages rather than silently
truncating the inventory; an inventory error blocks submission and offers retry.
The API still decides compatibility and available capacity, so a listed destination
is not a promise that migration will be accepted.

Timing and the optional owner-facing reason sit together. IP options appear when
the destination scope makes them applicable, following the legacy location/environment
rules. Cleanup, email, startup and error options stay visible. There is no advanced
options disclosure or repeated four-tile summary. Confirmation names the VPS and
destination and resets when any submitted value changes. A successful request is
queued/tracked, not proof of completed migration; errors preserve the form.
This replaces the hostname-only lookup and hidden reason requested by the maintainer
on 2026-09-28. See the [change record](../work-log/2026-09-28-vps-migration-ux.md)
for verification and release status.

**Failure contract:** edits/actions bind target, state and permission; mutations
return tracked results and retain errors. A node route being present is not proof
that every action is allowed for support/member roles. History cursors and status
sampling intervals need their real API semantics.
[Nodes](../../src/lib/api/nodes.ts), [history](../../src/lib/api/nodeHistory.ts),
[cluster](../../src/lib/api/cluster.ts), [migrations](../../src/lib/api/migrations.ts).

## Security advisories, audit, mail and content

**Intent:** members/public read applicable advisories; admins manage advisories,
updates, relations and associated outages/rebuilds. Audit history supports
operational investigation. Mail administration covers templates/translations,
mailboxes/handlers, recipients and delivery logs. Content includes news and
contextual help boxes.

**Failure contract:** privileged routes/actions remain independently gated; template
HTML preview must retain sandbox/remote-load defenses. Handler reorder partial
outcomes require reconciliation. Keep row/form errors where the edit happened.
Publication/email side effects require the actual requested scope, not incidental
permission to prepare documentation.
[Advisories](../../src/lib/api/securityAdvisories.ts), [audit](../../src/lib/api/audit.ts),
[mailer](../../src/lib/api/mailer.ts), [help boxes](../../src/lib/api/helpBoxes.ts).

## KB integration and documentation

**Intent:** maintain real navigation/page bindings, selected articles and usable
cs/en screenshots for the new UI, without replacing old evidence prematurely.
The separate KB repository pins UI and API independently, starts its owned test
cluster and uses real login/navigation on synthetic data. Fixture screenshots are
valuable layout proof but not KB live-capture proof.

**Contract:** semantic IDs/fingerprints follow changed routes/labels; screenshots
exclude real people, tokens and recovery material. Record receipts and avoid
repeating completed mutations. Production KB publication and transition strategy
remain separate approval/ownership decisions. [KB repository](https://github.com/vpsfreecz/vpsfree-kb-contracts),
[verification gates](VERIFICATION.md).

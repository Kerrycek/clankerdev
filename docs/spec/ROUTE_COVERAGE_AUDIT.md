# Route coverage audit (router.tsx → spec)

> Historical route audit (March 2026), retained for implementation archaeology.
> Its original external specification is unavailable; old section numbers cannot
> be verified. References below now point to related current workflow guidance,
> not recovered copies of those old sections. Use the
> [generated route inventory](../design/IMPLEMENTATION_INVENTORY.md) for current
> coverage and the [requirements register](../design/REQUIREMENTS.md) for intent.

This historical document aimed to ensure **every route** in `src/routes/router.tsx` has:
- a screen spec (in `SCREEN_SPECS.md`), or an explicit deferral note
- mode/scope/role access rules (in `MODE_AND_ROUTE_ACCESSIBILITY.md`)
- pagination rules for list routes (in `PAGINATION_AND_SEARCH.md` + `SCREEN_SPECS.md`)

Last updated: 2026-03-02

---

## OAuth routes (auth flow)

These are not shown in navigation, but must remain functional.

- `/oauth/login`
  - Current workflow: [Public entry and authentication](../design/WORKFLOWS.md#public-entry-and-authentication).
  - UX notes: short “Redirecting to sign-in…” screen; must be resilient to slow redirects; must have a safe error state.
- `/oauth/callback`
  - Current workflow: [Public entry and authentication](../design/WORKFLOWS.md#public-entry-and-authentication).
  - UX notes: show progress and a clear error if callback fails; must scrub OAuth params from history; provide path out.
- `/oauth/logout`
  - Current workflow: [Public entry and authentication](../design/WORKFLOWS.md#public-entry-and-authentication).
  - UX notes: show progress and link back to `/`; must handle token clear failures.

Mode/scope: not applicable.

---

## Wildcard routes (Not Found)

We do not redirect unknown routes.

- `/...` (public) → NotFound
- `/app/...` → NotFound
- `/admin/...` → NotFound

Spec: `AUTH_AND_FAILURE_SURFACES.md` (Not found)

---

## Public routes (PublicLayout)

- `/` (Status overview)
  - Spec: `SCREEN_SPECS.md` → “Public overview `/`”
  - Priority: `INFORMATION_PRIORITY_MAPS.md` → Outages/News (public)
- `/outages`
  - Spec: `SCREEN_SPECS.md` → “Outages list `/outages`”
- `/outages/:outageId`
  - Spec: `SCREEN_SPECS.md` → “Outage detail `/outages/:outageId`”
- `/news`
  - Spec: `SCREEN_SPECS.md` → “News `/news`”
- `/requests/registrations/:requestId/:token`
  - Current workflow: [Public entry and authentication](../design/WORKFLOWS.md#public-entry-and-authentication).

Access:
- Always reachable; not hidden behind obsolete UI-mode rules.

Pagination:
- News and resolved outages can require keyset pagination (“Load older”); see `SCREEN_SPECS.md`.

---

## Authenticated routes: Mine scope (`/app/*`)

- `/app` (Dashboard)
  - Spec: `SCREEN_SPECS.md` → Dashboard
- `/app/vps`
  - Spec: `SCREEN_SPECS.md` → VPS list
  - Pagination: required (keyset `from_id`)
- `/app/vps/:vpsId`
  - Spec: `SCREEN_SPECS.md` → VPS detail (header + tabs)
- `/app/vps/:vpsId/network`
  - Spec: `SCREEN_SPECS.md` → VPS tabs (Network)
- `/app/vps/:vpsId/storage`
  - Spec: `SCREEN_SPECS.md` → VPS tabs (Storage)
- `/app/vps/:vpsId/features`
  - Spec: `SCREEN_SPECS.md` → VPS tabs (Features)
- `/app/vps/:vpsId/maintenance`
  - Spec: `SCREEN_SPECS.md` → VPS tabs (Maintenance)
- `/app/vps/:vpsId/console`
  - Spec: `SCREEN_SPECS.md` → VPS tabs (Console)

- `/app/datasets`
- `/app/nas`
  - Current workflow: [Storage, NAS, snapshots, backup and export](../design/WORKFLOWS.md#storage-nas-snapshots-backup-and-export).
  - Notes: primary-pool datasets shortcut; same list implementation with fixed `role=primary` preset.
  - Spec: `SCREEN_SPECS.md` → Datasets/Storage list
  - Pagination: required
- `/app/exports`
  - Current workflow: [Storage, NAS, snapshots, backup and export](../design/WORKFLOWS.md#storage-nas-snapshots-backup-and-export).
  - Pagination: required
- `/app/exports/:exportId`
  - Current workflow: [Storage, NAS, snapshots, backup and export](../design/WORKFLOWS.md#storage-nas-snapshots-backup-and-export).
- `/app/datasets/:datasetId`
  - Spec: `SCREEN_SPECS.md` → Dataset detail (overview)
- `/app/datasets/:datasetId/snapshots`
  - Spec: `SCREEN_SPECS.md` → Dataset snapshots
- `/app/datasets/:datasetId/downloads`
  - Spec: `SCREEN_SPECS.md` → Dataset downloads
- `/app/datasets/:datasetId/exports`
  - Current workflow: [Storage, NAS, snapshots, backup and export](../design/WORKFLOWS.md#storage-nas-snapshots-backup-and-export).
- `/app/datasets/:datasetId/plans`
  - Current workflow: [Storage, NAS, snapshots, backup and export](../design/WORKFLOWS.md#storage-nas-snapshots-backup-and-export).
- `/app/datasets/:datasetId/expansion`
  - Current workflow: [Storage, NAS, snapshots, backup and export](../design/WORKFLOWS.md#storage-nas-snapshots-backup-and-export).

- `/app/dns`
  - Spec: `SCREEN_SPECS.md` → DNS zones list
  - Pagination: required
- `/app/dns/zones/:zoneId`
  - Spec: `SCREEN_SPECS.md` → DNS zone records
- `/app/dns/zones/:zoneId/settings`
  - Spec: `SCREEN_SPECS.md` → DNS zone settings
- `/app/dns/zones/:zoneId/logs`
  - Spec: `SCREEN_SPECS.md` → DNS logs

- `/app/transactions`
  - Spec: `SCREEN_SPECS.md` → Transaction chains
- `/app/transactions/items`
  - Spec: `SCREEN_SPECS.md` → Transactions list
- `/app/transactions/items/:transactionId`
  - Spec: `SCREEN_SPECS.md` → Transaction detail
- `/app/transactions/:chainId`
  - Spec: `SCREEN_SPECS.md` → Transaction chain detail

- `/app/action-states`
  - Spec: `SCREEN_SPECS.md` → Action states list
- `/app/action-states/:actionStateId`
  - Spec: `SCREEN_SPECS.md` → Action state detail

- `/app/monitoring`
  - Spec: `SCREEN_SPECS.md` → Monitoring events list
  - Pagination: required (keyset `from_id`)
- `/app/monitoring/:eventId`
  - Spec: `SCREEN_SPECS.md` → Monitoring event detail

- `/app/payments`
  - Spec: `SCREEN_SPECS.md` → Payments / billing
- `/app/requests`
  - Current workflow: [Applications, profile changes and review queues](../design/WORKFLOWS.md#applications-profile-changes-and-review-queues).
- `/app/requests/:type/:requestId`
  - Current workflow: [Applications, profile changes and review queues](../design/WORKFLOWS.md#applications-profile-changes-and-review-queues).

- `/app/profile`
  - Spec: `SCREEN_SPECS.md` → Profile / account

Route rules:
- Current route rules are documented in the [design handbook](../design/README.md).

---

## Authenticated routes: All scope (`/admin/*`, admins only)

Everything listed under `/app/*` has an `/admin/*` equivalent (same UI, different scope preset),
plus admin-only modules:

- `/admin` (Dashboard)
- `/admin/cluster` → redirect to `/admin/cluster/summary`
- `/admin/cluster/summary`
  - Current workflow: [Nodes, cluster and migrations](../design/WORKFLOWS.md#nodes-cluster-and-migrations).
- `/admin/cluster/environments`
  - Current workflow: [Nodes, cluster and migrations](../design/WORKFLOWS.md#nodes-cluster-and-migrations).
- `/admin/cluster/locations`
  - Current workflow: [Nodes, cluster and migrations](../design/WORKFLOWS.md#nodes-cluster-and-migrations).
- `/admin/cluster/os-templates`
  - Current workflow: [Nodes, cluster and migrations](../design/WORKFLOWS.md#nodes-cluster-and-migrations).
- `/admin/cluster/networks`
  - Current workflow: [Nodes, cluster and migrations](../design/WORKFLOWS.md#nodes-cluster-and-migrations).
- `/admin/cluster/networks/:networkId`
  - Current workflow: [Nodes, cluster and migrations](../design/WORKFLOWS.md#nodes-cluster-and-migrations).
- `/admin/cluster/resource-packages`
  - Current workflow: [Nodes, cluster and migrations](../design/WORKFLOWS.md#nodes-cluster-and-migrations).
- `/admin/cluster/resource-packages/:packageId`
  - Current workflow: [Nodes, cluster and migrations](../design/WORKFLOWS.md#nodes-cluster-and-migrations).
- `/admin/cluster/system-config`
  - Current workflow: [Nodes, cluster and migrations](../design/WORKFLOWS.md#nodes-cluster-and-migrations).
- `/admin/cluster/dns-resolvers`
  - Current workflow: [DNS and networking](../design/WORKFLOWS.md#dns-and-networking).

- `/admin/nodes`
  - Spec: `SCREEN_SPECS.md` → Admin: Nodes
  - Pagination: required when the list can grow
- `/admin/nodes/:nodeId`
  - Spec: `SCREEN_SPECS.md` → Node detail
- `/admin/migration-plans`
  - Spec: `SCREEN_SPECS.md` → Admin: Migrations
- `/admin/migration-plans/:planId`
  - Spec: `SCREEN_SPECS.md` → Migration plan detail
- `/admin/users`
  - Current workflow: [Account profile and user administration](../design/WORKFLOWS.md#account-profile-and-user-administration).
- `/admin/users/:userId`
  - Current workflow: [Account profile and user administration](../design/WORKFLOWS.md#account-profile-and-user-administration).
  - Tabs: Overview, Payments, Environment configs, Security, MFA, Sessions, SSH keys, Metrics, Mail, User data, History
- `/admin/admin-info`
  - Spec: `SCREEN_SPECS.md` → Admin info / Diagnostics
  - Mode: see canonical redesign spec (obsolete UI-mode gating removed)

- `/admin/audit`
  - Spec: `SCREEN_SPECS.md` → Admin: Audit (Object history)
  - Pagination: required (keyset `from_id`, newest-first)
- `/admin/audit/:historyId`
  - Spec: `SCREEN_SPECS.md` → Admin: Audit event detail

- `/admin/requests`
  - Spec: `SCREEN_SPECS.md` → Admin: Requests
  - Pagination: required (keyset `from_id`)
- `/admin/requests/:type/:requestId`
  - Spec: `SCREEN_SPECS.md` → Admin: Request detail

- `/admin/mailer/templates`
  - Current workflow: [Security advisories, audit, mail and content](../design/WORKFLOWS.md#security-advisories-audit-mail-and-content).
  - Pagination: required (keyset `from_id`)
- `/admin/mailer/templates/:mailTemplateId`
  - Current workflow: [Security advisories, audit, mail and content](../design/WORKFLOWS.md#security-advisories-audit-mail-and-content).
- `/admin/mailer/templates/:mailTemplateId/translations/:translationId`
  - Current workflow: [Security advisories, audit, mail and content](../design/WORKFLOWS.md#security-advisories-audit-mail-and-content).

- `/admin/mailer/mailboxes`
  - Current workflow: [Security advisories, audit, mail and content](../design/WORKFLOWS.md#security-advisories-audit-mail-and-content).
  - Pagination: required (keyset `from_id`)
- `/admin/mailer/mailboxes/:mailboxId`
  - Current workflow: [Security advisories, audit, mail and content](../design/WORKFLOWS.md#security-advisories-audit-mail-and-content).

- `/admin/mailer/recipients`
  - Current workflow: [Security advisories, audit, mail and content](../design/WORKFLOWS.md#security-advisories-audit-mail-and-content).
  - Pagination: required (keyset `from_id`)

- `/admin/mailer/log`
  - Current workflow: [Security advisories, audit, mail and content](../design/WORKFLOWS.md#security-advisories-audit-mail-and-content).
  - Pagination: required (keyset `from_id`)
- `/admin/mailer/log/:mailLogId`
  - Current workflow: [Security advisories, audit, mail and content](../design/WORKFLOWS.md#security-advisories-audit-mail-and-content).

- `/admin/payments/incoming`
  - Spec: `SCREEN_SPECS.md` → Admin: Incoming payments
  - Pagination: required (keyset `from_id`)
- `/admin/payments/incoming/:paymentId`
  - Spec: `SCREEN_SPECS.md` → Admin: Incoming payment detail

Access:
- Role-gated: non-admins must receive a forbidden screen.
- Scope switching semantics are locked in `MODE_AND_ROUTE_ACCESSIBILITY.md`.

---

## Catch-all

- `*` → redirect to `/`
  - Spec: `ERRORS_AND_EMPTY_STATES.md` (not found / navigation)


- `/app/dns/zones/:zoneId/transfers`
  - Current workflow: [DNS and networking](../design/WORKFLOWS.md#dns-and-networking).
  - Notes: list + create/delete transfer peers, copyable server snippet.
- `/app/dns/zones/:zoneId/dnssec`
  - Current workflow: [DNS and networking](../design/WORKFLOWS.md#dns-and-networking).
  - Notes: DNSKEY + DS copy blocks.
- `/app/dns/zones/:zoneId/servers`
  - Current workflow: [DNS and networking](../design/WORKFLOWS.md#dns-and-networking).
  - Notes: serial/load/refresh/expire state; admin can add/remove servers.
- `/admin/cluster/dns-servers`
  - Current workflow: [DNS and networking](../design/WORKFLOWS.md#dns-and-networking).
  - Notes: list + create/edit/delete authoritative DNS servers.
- `/admin/cluster/dns-tsig-keys`
  - Current workflow: [DNS and networking](../design/WORKFLOWS.md#dns-and-networking).
  - Notes: list + create/delete TSIG keys, reveal/copy secret.
- `/admin/nas`
  - Current workflow: [Storage, NAS, snapshots, backup and export](../design/WORKFLOWS.md#storage-nas-snapshots-backup-and-export).
  - Notes: admin NAS alias; fixed `role=primary` preset with owner column and no VPS filter.
- `/admin/exports`
  - Current workflow: [Storage, NAS, snapshots, backup and export](../design/WORKFLOWS.md#storage-nas-snapshots-backup-and-export).
  - Notes: global exports list with create flow, SFI filters, keyset pagination.
- `/admin/exports/:exportId`
  - Current workflow: [Storage, NAS, snapshots, backup and export](../design/WORKFLOWS.md#storage-nas-snapshots-backup-and-export).
  - Notes: summary, mount instructions, allowed host management.
- `/admin/datasets/:datasetId/exports`
  - Current workflow: [Storage, NAS, snapshots, backup and export](../design/WORKFLOWS.md#storage-nas-snapshots-backup-and-export).
  - Notes: dataset-scoped embedded exports list.
- `/admin/datasets/:datasetId/plans`
  - Current workflow: [Storage, NAS, snapshots, backup and export](../design/WORKFLOWS.md#storage-nas-snapshots-backup-and-export).
  - Notes: dataset-scoped plan assignments.
- `/admin/datasets/:datasetId/expansion`
  - Current workflow: [Storage, NAS, snapshots, backup and export](../design/WORKFLOWS.md#storage-nas-snapshots-backup-and-export).
  - Notes: dataset-scoped expansion summary, settings and history.
